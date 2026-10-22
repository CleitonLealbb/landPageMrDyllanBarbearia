import { beforeEach, describe, expect, it } from "vitest"
import { prismaMock } from "../setup/prisma-mock"
import { ownerSession, professionalBarberSession, superAdminSession } from "../setup/session-fixtures"
import { executiveSummary } from "@/lib/dashboard/summary"
import { dashboardPeriod } from "@/lib/dashboard/period"
const request = (query = "") => new Request(`http://localhost/api/dashboard/summary?executive=true${query}`)
describe("Dashboard executivo", () => {
  beforeEach(() => {
    prismaMock.barbershop.findUnique.mockResolvedValue({ timezone: "America/Cuiaba", status: "ACTIVE" })
    prismaMock.professional.findMany.mockResolvedValue([{ id: "p1", name: "Ana", commission: 40 }])
    prismaMock.barbershopCustomer.count.mockResolvedValue(0)
    prismaMock.$transaction.mockImplementation(async (...args: unknown[]) => Promise.all(args[0] as unknown[]))
  })
  it("exige sessão e permissão de proprietário", async () => {
    expect((await executiveSummary(request(), null)).status).toBe(401)
    for (const session of [professionalBarberSession, superAdminSession]) expect((await executiveSummary(request(), session)).status).toBe(403)
    expect(prismaMock.professional.findMany).not.toHaveBeenCalled()
  })
  it("isola todas as consultas pela barbearia da sessão e mantém ausências como null", async () => {
    const response = await executiveSummary(request(), ownerSession)
    expect(response.status).toBe(200)
    for (const [args] of prismaMock.barbershopCustomer.count.mock.calls) expect(args).toEqual(expect.objectContaining({ where: expect.objectContaining({ barbershopId: ownerSession.barbershopId }) }))
    expect(prismaMock.professional.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: ownerSession.barbershopId } }))
    expect((await response.json()).metrics).toEqual(expect.objectContaining({ newCustomers: 0, grossCents: null, averageTicketCents: null, cancellations: null, occupancy: null }))
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })
  it.each(["&barbershopId=other", "&period=invalid", "&compare=yes", "&period=custom&start=2026-02-30&end=2026-03-01", "&period=custom&start=2026-10-21&end=2026-10-01", "&period=today&period=year", "&professionalId="])("rejeita parâmetro inválido %s", async query => {
    expect((await executiveSummary(request(query), ownerSession)).status).toBe(400)
    expect(prismaMock.barbershopCustomer.count).not.toHaveBeenCalled()
  })
  it("rejeita profissional de outro tenant", async () => {
    expect((await executiveSummary(request("&professionalId=foreign"), ownerSession)).status).toBe(400)
  })
  it("não atribui cadastros sem vínculo a um profissional", async () => {
    const body = await (await executiveSummary(request("&professionalId=p1"), ownerSession)).json()
    expect(body.metrics.newCustomers).toBeNull()
    expect(prismaMock.barbershopCustomer.count).not.toHaveBeenCalled()
  })
  it("conta cadastros no intervalo e período anterior", async () => {
    prismaMock.barbershopCustomer.count.mockResolvedValueOnce(8).mockResolvedValueOnce(12).mockResolvedValueOnce(4)
    const body = await (await executiveSummary(request("&period=custom&start=2026-10-01&end=2026-10-07&compare=true"), ownerSession)).json()
    expect(body.metrics).toEqual(expect.objectContaining({ newCustomers: 8, activeCustomers: 12, previousNewCustomers: 4 }))
    expect(prismaMock.barbershopCustomer.count).toHaveBeenNthCalledWith(1, { where: { barbershopId: ownerSession.barbershopId, createdAt: { gte: new Date("2026-10-01T04:00:00Z"), lt: new Date("2026-10-08T04:00:00Z") } } })
  })
})
describe("Períodos locais", () => {
  it.each(["today", "yesterday", "week", "month", "previousMonth", "year"])("resolve %s no fuso da barbearia", period => {
    const result = dashboardPeriod(new URLSearchParams({ period }), "America/Cuiaba", new Date("2026-10-21T02:00:00Z"))
    expect(result.end).toBe(period === "yesterday" ? "2026-10-19" : period === "previousMonth" ? "2026-09-30" : "2026-10-20")
    expect(result.current.gte.getUTCHours()).toBe(4)
    expect(result.previous.lt).toEqual(result.current.gte)
  })
  it("respeita mudança de horário de verão", () => {
    const result = dashboardPeriod(new URLSearchParams({ period: "custom", start: "2026-03-08", end: "2026-03-08" }), "America/New_York")
    expect(result.current.lt.getTime() - result.current.gte.getTime()).toBe(23 * 3600000)
  })
})
