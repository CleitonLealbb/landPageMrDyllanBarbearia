import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, owner, setupCheckout } from "../setup/checkout"
import { cashHistoryTotals } from "@/lib/checkout/history-totals"
const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: session }))
import { GET as sales } from "@/app/api/checkout/sales/route"
import { GET as cash } from "@/app/api/checkout/cash-sessions/[id]/route"
const req = (query = "") => new Request(`http://test/api/checkout/history?${query}`)
const params = (id = "original") => ({ params: Promise.resolve({ id }) })
const methodGroups = [
  { method: "PIX" as const, _sum: { appliedCents: 14000, refundedCents: 4000, cashReceivedCents: null, changeCents: 0 } },
  { method: "CASH" as const, _sum: { appliedCents: 14000, refundedCents: 5000, cashReceivedCents: 16000, changeCents: 2000 } },
]
const saleGroups = [{ status: "PAID" as const, _sum: { totalCents: 19000 } }, { status: "CANCELED" as const, _sum: { totalCents: 9000 } }]
const eligible = { barbershopId: "shop", cashSessionId: "original", finalizedAt: { not: null }, status: { in: ["PAID", "CANCELED"] } }
beforeEach(() => {
  setupCheckout(); session.mockResolvedValue(owner.session)
  db.barbershop.findFirst.mockResolvedValue({ timezone: "America/Sao_Paulo" })
  db.sale.findMany.mockResolvedValue([])
  db.cashSession.findFirst.mockResolvedValue({ id: "original", status: "CLOSED", shift: "Manhã", openedAt: new Date(), closedAt: new Date(), openingBalanceCents: 1000, expectedBalanceCents: 15000, countedBalanceCents: 15000, differenceCents: 0, notes: "Privado", cashRegister: { name: "Principal" }, openedBy: { nameSnapshot: "Operador" }, closedBy: null })
  db.cashMovement.findMany.mockResolvedValue([])
  db.cashMovement.groupBy.mockResolvedValue([{ kind: "OPENING", _sum: { amountCents: 1000 } }, { kind: "SALE", _sum: { amountCents: 14000 } }])
  db.payment.groupBy.mockResolvedValue(methodGroups); db.sale.groupBy.mockResolvedValue(saleGroups)
})
describe("Histórico: agregações financeiras somente leitura", () => {
  it("ordena métodos únicos e preserva método de pagamento estornado sem N+1", async () => {
    db.sale.findMany.mockResolvedValue([{ id: "sale", status: "CANCELED", finalizedAt: new Date(), canceledAt: new Date(), voidedAt: null, createdAt: new Date(), totalCents: 1000, customer: null, cashSession: null, saleItem_sale: [], payment_sale: [{ method: "PIX" }, { method: "CREDIT_CARD" }, { method: "CASH" }, { method: "PIX" }, { method: "DEBIT_CARD" }] }])
    const response = await sales(req()), body = await response.json()
    expect(body.items[0].paymentMethods).toEqual(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD"])
    expect(db.sale.findMany).toHaveBeenCalledOnce(); expect(db.payment.findMany).not.toHaveBeenCalled()
    expect(db.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ payment_sale: { where: { barbershopId: "shop" }, select: { method: true } } }) }))
  })
  it("histórico padrão contém apenas PAID e cancelamentos finalizados", async () => {
    await sales(req())
    expect(db.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AND: expect.arrayContaining([{ OR: [{ status: "PAID", finalizedAt: { not: null } }, { status: "CANCELED", finalizedAt: { not: null } }] }]) }) }))
  })
  it("incluir descartadas acrescenta VOIDED e descarte legado, sem PENDING", async () => {
    await sales(req("includeVoided=true"))
    expect(db.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AND: expect.arrayContaining([{ OR: [{ status: "PAID", finalizedAt: { not: null } }, { status: "CANCELED", finalizedAt: { not: null } }, { status: "VOIDED" }, { status: "CANCELED", finalizedAt: null }] }]) }) }))
  })
  it("comandas abertas filtram somente PENDING", async () => {
    await sales(req("view=open"))
    expect(db.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AND: expect.arrayContaining([{ status: "PENDING" }]) }) }))
  })
  it("cursor fica vinculado ao contexto e ao filtro de descartadas", async () => {
    const row = { id: "sale", status: "PAID", finalizedAt: new Date(), canceledAt: null, voidedAt: null, createdAt: new Date(), totalCents: 1000, customer: null, cashSession: null, saleItem_sale: [], payment_sale: [] }
    db.sale.findMany.mockResolvedValue([row, { ...row, id: "older" }])
    const body = await (await sales(req("pageSize=1"))).json()
    expect(body.nextCursor).toBeTruthy()
    expect((await sales(req(`pageSize=1&includeVoided=true&cursor=${body.nextCursor}`))).status).toBe(400)
    expect((await sales(req(`pageSize=1&view=open&cursor=${body.nextCursor}`))).status).toBe(400)
  })
  it.each(["view=invalid", "includeVoided=yes", "view=open&includeVoided=true", "view=open&status=PAID", "view=history&status=PENDING", "status=VOIDED", "includeVoided=true&includeVoided=false", "tenantRole=BARBERSHOP_OWNER", "barbershopId=other"])("recusa filtros incompatíveis/identidade: %s", async query => {
    expect((await sales(req(query))).status).toBe(400); expect(db.sale.findMany).not.toHaveBeenCalled()
  })
  it("totais incluem pagamentos originais e estornos posteriores, mantendo caixa físico", async () => {
    const body = await (await cash(req("pageSize=1"), params())).json()
    expect(body).toMatchObject({ ledgerBalanceCents: 15000, cashReceivedCents: 16000, cashChangeCents: 2000, cashOriginalEffectCents: 14000, finalizedSalesTotalCents: 28000, currentlyPaidSalesTotalCents: 19000, canceledSalesTotalCents: 9000 })
    expect(body.paymentTotals).toEqual([
      { method: "CASH", appliedCents: 14000, refundedCents: 5000, netAppliedCents: 9000 }, { method: "PIX", appliedCents: 14000, refundedCents: 4000, netAppliedCents: 10000 },
      { method: "DEBIT_CARD", appliedCents: 0, refundedCents: 0, netAppliedCents: 0 }, { method: "CREDIT_CARD", appliedCents: 0, refundedCents: 0, netAppliedCents: 0 },
    ])
    expect(body.session.expectedBalanceCents).toBe(15000)
  })
  it("agrega sessão inteira sem cursor, paginação ou filtro de pagamento ativo", async () => {
    await cash(req("pageSize=1"), params())
    expect(db.payment.groupBy).toHaveBeenCalledExactlyOnceWith({ by: ["method"], where: { barbershopId: "shop", sale: eligible }, _sum: { appliedCents: true, refundedCents: true, cashReceivedCents: true, changeCents: true } })
    expect(db.sale.groupBy).toHaveBeenCalledExactlyOnceWith({ by: ["status"], where: eligible, _sum: { totalCents: true } })
    expect(db.cashMovement.groupBy).toHaveBeenCalledExactlyOnceWith({ by: ["kind"], where: { barbershopId: "shop", cashSessionId: "original" }, _sum: { amountCents: true } })
  })
  it("PIX/cartões aumentam indicadores financeiros sem alterar o saldo físico", async () => {
    db.payment.groupBy.mockResolvedValue([...methodGroups, { method: "DEBIT_CARD", _sum: { appliedCents: 100000, refundedCents: 0, cashReceivedCents: null, changeCents: 0 } }, { method: "CREDIT_CARD", _sum: { appliedCents: 100000, refundedCents: 0, cashReceivedCents: null, changeCents: 0 } }])
    expect((await (await cash(req(), params())).json()).ledgerBalanceCents).toBe(15000)
  })
  it("devolução em outra sessão pertence fisicamente somente ao caixa de devolução", async () => {
    const original = await (await cash(req(), params())).json()
    db.cashMovement.groupBy.mockResolvedValue([{ kind: "OPENING", _sum: { amountCents: 5000 } }, { kind: "REVERSAL", _sum: { amountCents: 5000 } }])
    db.sale.groupBy.mockResolvedValue([]); db.payment.groupBy.mockResolvedValue([])
    const refund = await (await cash(req(), params("refund"))).json()
    expect(original.ledgerBalanceCents).toBe(15000); expect(original.paymentTotals[0].refundedCents).toBe(5000)
    expect(refund).toMatchObject({ ledgerBalanceCents: 0, finalizedSalesTotalCents: 0, cashReceivedCents: 0 })
    expect(db.cashMovement.groupBy.mock.calls.at(-1)?.[0]).toMatchObject({ where: { cashSessionId: "refund", barbershopId: "shop" } })
  })
  it("VOIDED e cancelamentos sem finalizedAt não participam dos agregados", async () => {
    await cash(req(), params())
    expect(db.sale.groupBy.mock.calls[0][0]).toMatchObject({ where: { finalizedAt: { not: null }, status: { in: ["PAID", "CANCELED"] } } })
    expect(db.payment.groupBy.mock.calls[0][0]).toMatchObject({ where: { sale: { finalizedAt: { not: null }, status: { in: ["PAID", "CANCELED"] } } } })
  })
  it.each(["BARBERSHOP_OWNER", "ASSISTANT"])("%s recebe totais sem dados privados nem escritas", async tenantRole => {
    session.mockResolvedValue({ ...owner.session, tenantRole })
    const body = await (await cash(req(), params())).json()
    if (tenantRole === "ASSISTANT") expect(body.notes).toBeNull()
    expect(JSON.stringify(body)).not.toMatch(/barbershopId|password|email|actorId|costCents|requestHash/)
    for (const delegate of [db.payment, db.sale, db.cashMovement, db.cashSession]) for (const op of ["create", "update", "updateMany", "createMany"] as const) expect(delegate[op]).not.toHaveBeenCalled()
  })
  it("barbeiro não acessa agregados de caixa", async () => {
    session.mockResolvedValue({ ...owner.session, tenantRole: "BARBER" })
    expect((await cash(req(), params())).status).toBe(403); expect(db.payment.groupBy).not.toHaveBeenCalled()
  })
  it("zeros, métodos estáveis e somas superiores a Int32 permanecem inteiros seguros", () => {
    expect(cashHistoryTotals([], []).paymentTotals).toHaveLength(4)
    expect(cashHistoryTotals([], [{ status: "PAID", _sum: { totalCents: 3000000000 } }]).finalizedSalesTotalCents).toBe(3000000000)
    expect(() => cashHistoryTotals([], [{ status: "PAID", _sum: { totalCents: Number.MAX_SAFE_INTEGER + 1 } }])).toThrow()
  })
})
