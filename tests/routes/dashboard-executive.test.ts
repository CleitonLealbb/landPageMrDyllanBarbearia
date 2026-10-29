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
    prismaMock.sale.findMany.mockResolvedValue([])
    prismaMock.$transaction.mockImplementation(async (...args: unknown[]) => typeof args[0] === "function" ? (args[0] as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock) : Promise.all(args[0] as unknown[]))
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
    expect((await response.json()).metrics).toEqual(expect.objectContaining({ newCustomers: 0, grossCents: 0, averageTicketCents: 0, cancellations: null, occupancy: null }))
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
  it("consulta Sale por tenant, status e competência financeira em ambos os períodos", async () => {
    const response = await executiveSummary(request("&period=custom&start=2026-10-01&end=2026-10-07&compare=true"), ownerSession)
    const body = await response.json()
    expect(body.finance).toMatchObject({ source: "CHECKOUT", scope: "TENANT", current: { paidSales: 0, paidTotalCents: 0 }, previous: { paidSales: 0, paidTotalCents: 0 } })
    const current = { gte: new Date("2026-10-01T04:00:00Z"), lt: new Date("2026-10-08T04:00:00Z") }
    const previous = { gte: new Date("2026-09-24T04:00:00Z"), lt: new Date("2026-10-01T04:00:00Z") }
    for (const [index, status, field, range] of [[1, "PAID", "finalizedAt", current], [2, "CANCELED", "canceledAt", current], [3, "PAID", "finalizedAt", previous], [4, "CANCELED", "canceledAt", previous]] as const) {
      expect(prismaMock.sale.findMany).toHaveBeenNthCalledWith(index, expect.objectContaining({ where: { barbershopId: ownerSession.barbershopId, status, [field]: range, ...(status === "CANCELED" ? { finalizedAt: { not: null } } : {}) } }))
    }
    const select = (prismaMock.sale.findMany.mock.calls[0][0] as { select: unknown }).select
    expect(JSON.stringify(select)).not.toMatch(/cashReceivedCents|changeCents|costCents|password|createdAt|commissionBasisPoints/)
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 20000 })
  })
  it("sem comparação não consulta o período anterior e aplica filtro profissional tenant-safe", async () => {
    const body = await (await executiveSummary(request("&professionalId=p1"), ownerSession)).json()
    expect(body.finance.scope).toBe("SALES_WITH_PROFESSIONAL"); expect(body.finance.previous).toBeNull()
    expect(prismaMock.sale.findMany).toHaveBeenCalledTimes(2)
    for (const [query] of prismaMock.sale.findMany.mock.calls) expect(query).toMatchObject({ where: { barbershopId: ownerSession.barbershopId, saleItem_sale: { some: { barbershopId: ownerSession.barbershopId, saleServiceComponent_saleItem: { some: { barbershopId: ownerSession.barbershopId, professionalId: "p1" } } } } } })
  })
  it("integra vendas pagas e cancelamentos financeiros, exclui pendentes e descartes reais/legados e compara períodos", async () => {
    const row = (id: string, status: "PAID" | "PENDING" | "VOIDED" | "CANCELED", finalizedAt: Date | null, totalCents: number, shop = ownerSession.barbershopId) => ({ id, status, barbershopId: shop, finalizedAt, canceledAt: status === "CANCELED" ? new Date("2026-10-01T15:00:00Z") : null, totalCents, discountCents: 0, tipCents: 0, saleItem_sale: [], payment_sale: [] })
    const rows = [row("paid", "PAID", new Date("2026-10-01T04:00:00Z"), 10000), row("previous", "PAID", new Date("2026-09-30T04:00:00Z"), 5000), row("pending", "PENDING", null, 80000), row("canceled", "CANCELED", new Date("2026-10-01T14:00:00Z"), 9000), row("legacy-discard", "CANCELED", null, 75000), row("discard", "VOIDED", null, 60000), row("foreign", "PAID", new Date("2026-10-01T15:00:00Z"), 999999, "foreign-shop"), row("end", "PAID", new Date("2026-10-02T04:00:00Z"), 100000)]
    prismaMock.sale.findMany.mockImplementation(async (...args: unknown[]) => {
      const where = (args[0] as { where: { barbershopId: string; status: string; finalizedAt?: { gte: Date; lt: Date } | { not: null }; canceledAt?: { gte: Date; lt: Date } } }).where
      const range = (where.status === "PAID" ? where.finalizedAt : where.canceledAt) as { gte: Date; lt: Date }
      return rows.filter(row => { const date = where.status === "PAID" ? row.finalizedAt : row.canceledAt; return row.barbershopId === where.barbershopId && row.status === where.status && (where.status !== "CANCELED" || row.finalizedAt !== null) && date && date >= range.gte && date < range.lt })
    })
    const body = await (await executiveSummary(request("&period=custom&start=2026-10-01&end=2026-10-01&compare=true"), ownerSession)).json()
    expect(body.metrics).toMatchObject({ grossCents: 10000, averageTicketCents: 10000, appointments: null, cancellations: null })
    expect(body.finance.current).toMatchObject({ paidTotalCents: 10000, paidSales: 1, canceledSales: 1, canceledAmountCents: 9000 })
    expect(body.finance.previous).toMatchObject({ paidTotalCents: 5000, paidSales: 1, canceledSales: 0 })
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
