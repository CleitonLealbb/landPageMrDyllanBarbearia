import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, knownError, owner, role, setupCheckout } from "../setup/checkout"
const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: session }))
import * as collection from "@/app/api/checkout/cash-registers/route"
import * as resource from "@/app/api/checkout/cash-registers/[id]/route"
import { POST as open } from "@/app/api/checkout/cash-sessions/open/route"
import { cashHistory, createRegister, listCashSessions, listRegisters, updateRegister } from "@/lib/checkout/production"

const row = { id: "register", name: "Recepção", active: true }
const route = { params: Promise.resolve({ id: "register" }) }
function request(body: unknown, key: string | null = "register-request") { return new Request("http://test/api/checkout/cash-registers", { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) }) }
beforeEach(() => {
  setupCheckout(); session.mockResolvedValue(owner.session)
  db.cashRegister.findMany.mockResolvedValue([{ ...row, cashSession_cashRegister: [] }, { id: "inactive", name: "Reserva", active: false, cashSession_cashRegister: [] }])
  db.cashRegister.findFirst.mockResolvedValue(row)
  db.cashRegister.create.mockResolvedValue(row)
  db.cashRegister.update.mockResolvedValue(row)
  db.cashSession.findFirst.mockResolvedValue(null)
})
describe("Administração de caixas: HTTP, tenant e auditoria", () => {
  it("lista ativos e inativos com DTO mínimo e consultas tenant-safe", async () => {
    const response = await collection.GET(new Request("http://test"))
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toEqual({ registers: [{ ...row, hasOpenSession: false, openSession: null }, { id: "inactive", name: "Reserva", active: false, hasOpenSession: false, openSession: null }] })
    expect(db.cashRegister.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop" }, select: expect.objectContaining({ cashSession_cashRegister: expect.objectContaining({ where: { barbershopId: "shop", status: "OPEN" } }) }) }))
  })
  it("retorna somente ID e estado da sessão aberta", async () => {
    db.cashRegister.findMany.mockResolvedValue([{ ...row, cashSession_cashRegister: [{ id: "cash", status: "OPEN" }] }])
    const json = await (await collection.GET(new Request("http://test"))).json()
    expect(json.registers[0]).toEqual({ ...row, hasOpenSession: true, openSession: { id: "cash", status: "OPEN" } })
    expect(JSON.stringify(json)).not.toMatch(/barbershopId|actor|balance|userId|email/)
  })
  it("exige sessão e não expõe DELETE", async () => {
    session.mockResolvedValue(null)
    expect((await collection.GET(new Request("http://test"))).status).toBe(401)
    expect((await collection.POST(request({ name: "Recepção" }))).status).toBe(401)
    expect(collection).not.toHaveProperty("DELETE"); expect(resource).not.toHaveProperty("DELETE")
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it.each(["ASSISTANT", "BARBER"] as const)("%s não administra nem por acesso direto ao serviço", async value => {
    session.mockResolvedValue(role(value).session)
    expect((await collection.GET(new Request("http://test"))).status).toBe(403)
    expect((await collection.POST(request({ name: "Nome" }))).status).toBe(403)
    expect((await resource.PATCH(request({ active: false }), route)).status).toBe(403)
    expect(() => listRegisters(role(value))).toThrow()
    expect(() => createRegister(role(value), "key", { name: "Nome" })).toThrow()
    expect(() => updateRegister(role(value), "key", "register", { active: true })).toThrow()
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it("normaliza nome, cria ativo sem saldo e audita sem venda fictícia", async () => {
    expect((await collection.POST(request({ name: "  Recepção  " }))).status).toBe(201)
    expect(db.cashRegister.create).toHaveBeenCalledWith({ data: { name: "Recepção", active: true, barbershopId: "shop" }, select: { id: true, name: true, active: true } })
    expect(db.checkoutAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "cash_register.created", entity: "CashRegister", entityId: "register", metadata: expect.objectContaining({ after: row }) }) }))
    expect(db.checkoutIdempotency.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ saleId: null, operation: "cash_register.created" }) }))
    expect(db.cashMovement.create).not.toHaveBeenCalled(); expect(db.cashSession.create).not.toHaveBeenCalled()
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 })
  })
  it.each(["", "   ", "a".repeat(81), "a\u200bb"])("rejeita nome inválido", async name => {
    expect((await collection.POST(request({ name }))).status).toBe(400); expect(db.$transaction).not.toHaveBeenCalled()
  })
  it.each([{ name: "Nome", barbershopId: "other" }, { name: "Nome", active: false }, { name: "Nome", role: "BARBERSHOP_OWNER" }])("recusa campos não autorizados", async payload => {
    expect((await collection.POST(request(payload))).status).toBe(400)
  })
  it("exige payload e idempotência no PATCH", async () => {
    expect((await resource.PATCH(request({}), route)).status).toBe(400)
    expect((await resource.PATCH(request({ name: "Nome" }, null), route)).status).toBe(400)
    expect((await resource.PATCH(request({ active: true, expectedVersion: 0 }), route)).status).toBe(400)
  })
  it.each([{ name: "Novo nome" }, { active: true }, { active: false }])("altera somente cadastro com lock e auditoria antes/depois: %j", async input => {
    const after = { ...row, ...input }; db.cashRegister.update.mockResolvedValue(after)
    const response = await resource.PATCH(request(input), route)
    expect(response.status).toBe(200); expect(await response.json()).toEqual(after)
    const query = db.$queryRaw.mock.calls[0][0] as { values: unknown[]; strings: string[] }
    expect(query.values).toEqual(["shop", "register"]); expect(query.strings.join("")).toContain('"CashRegister"'); expect(query.strings.join("")).toContain("FOR UPDATE")
    expect(db.cashRegister.update).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId_id: { barbershopId: "shop", id: "register" } }, data: input }))
    expect(db.checkoutAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "name" in input ? "cash_register.renamed" : input.active ? "cash_register.activated" : "cash_register.deactivated", metadata: expect.objectContaining({ before: row, after }) }) }))
    for (const delegate of [db.cashMovement, db.cashSession, db.sale, db.payment, db.inventoryMovement]) { expect(delegate.create).not.toHaveBeenCalled(); expect(delegate.update).not.toHaveBeenCalled() }
  })
  it("audita também renomeação combinada com ativação", async () => {
    await resource.PATCH(request({ name: "Outro", active: true }), route)
    expect(db.checkoutAuditEvent.create.mock.calls.map(call => (call[0] as { data: { action: string } }).data.action)).toEqual(["cash_register.renamed", "cash_register.activated"])
  })
  it("impede inativar aberto, sem fechar ou alterar histórico", async () => {
    db.cashSession.findFirst.mockResolvedValue({ id: "cash" })
    const response = await resource.PATCH(request({ active: false }), route)
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ message: "Feche a sessão aberta antes de inativar este caixa." })
    expect(db.cashRegister.update).not.toHaveBeenCalled(); expect(db.cashSession.update).not.toHaveBeenCalled(); expect(db.checkoutAuditEvent.create).not.toHaveBeenCalled()
  })
  it("recusa abrir inativo depois do mesmo lock, antes de sessão ou movimento", async () => {
    db.cashRegister.findFirst.mockResolvedValue({ ...row, active: false })
    expect((await open(request({ cashRegisterId: "register", openingBalanceCents: 0, shift: "Manhã" }))).status).toBe(409)
    expect(db.$queryRaw).toHaveBeenCalled(); expect(db.cashSession.create).not.toHaveBeenCalled(); expect(db.cashMovement.create).not.toHaveBeenCalled()
  })
  it("caixa de outro tenant não é encontrado ou alterado", async () => {
    db.$queryRaw.mockResolvedValue([])
    expect((await resource.PATCH(request({ name: "Novo" }), route)).status).toBe(404)
    expect(db.cashRegister.update).not.toHaveBeenCalled()
  })
  it("sessões encerradas continuam legíveis após inativação ou renomeação", async () => {
    const date = new Date("2026-10-29T12:00:00Z")
    const historical = { id: "cash", cashRegisterId: "register", status: "CLOSED", shift: "Manhã", openedAt: date, closedAt: date, openingBalanceCents: 5000, expectedBalanceCents: 5000, countedBalanceCents: 5000, differenceCents: 0, cashRegister: { name: "Nome atual" }, openedBy: { nameSnapshot: "Operador histórico" }, closedBy: { nameSnapshot: "Operador histórico" }, notes: null }
    db.cashRegister.findFirst.mockResolvedValue({ ...row, active: false, name: "Nome atual" })
    db.barbershop.findFirst.mockResolvedValue({ timezone: "America/Sao_Paulo" })
    db.cashSession.findFirst.mockResolvedValue(historical); db.cashSession.findMany.mockResolvedValue([historical])
    db.payment.groupBy.mockResolvedValue([]); db.sale.groupBy.mockResolvedValue([])
    const list = await listCashSessions(owner, new URLSearchParams("period=custom&start=2026-10-01&end=2026-10-31"))
    const detail = await cashHistory(owner, "cash", new URLSearchParams())
    expect(list.status).toBe(200); expect(detail.status).toBe(200)
    expect(JSON.stringify(detail.body)).toContain("Nome atual"); expect(JSON.stringify(detail.body)).toContain("Operador histórico")
    const listQuery = db.cashSession.findMany.mock.calls[0][0] as { where: unknown }
    expect(JSON.stringify(listQuery.where)).not.toContain('"active"')
    expect(db.cashSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop", id: "cash" } }))
    expect(db.cashSession.update).not.toHaveBeenCalled(); expect(db.cashMovement.update).not.toHaveBeenCalled()
  })
  it.each(["P2002", "P2034", "P2003", "P2025"])("conflito %s é seguro", async code => {
    db.cashRegister.create.mockRejectedValue(knownError(code))
    const response = await collection.POST(request({ name: "Nome" }))
    expect(response.status).toBe(409); expect(JSON.stringify(await response.json())).not.toMatch(/SECRET|SQL|password|constraint|stack|barbershopId/)
  })
  it("erro desconhecido permanece genérico", async () => {
    db.cashRegister.create.mockRejectedValue(new Error("SECRET SQL"))
    const response = await collection.POST(request({ name: "Nome" }))
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ message: "Erro interno do servidor." })
  })
  it("replay administrativo não repete cadastro nem auditoria", async () => {
    await collection.POST(request({ name: "Nome" }))
    const saved = (db.checkoutIdempotency.create.mock.calls[0][0] as { data: unknown }).data
    db.checkoutIdempotency.findUnique.mockResolvedValue(saved)
    expect((await collection.POST(request({ name: "Nome" }))).status).toBe(201)
    expect(db.cashRegister.create).toHaveBeenCalledTimes(1); expect(db.checkoutAuditEvent.create).toHaveBeenCalledTimes(1)
    expect((await collection.POST(request({ name: "Outro" }))).status).toBe(409)
  })
})
