import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, knownError, owner, role, sale, serviceComponent, setupCheckout } from "../setup/checkout"

const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: session }))

import { POST as discard } from "@/app/api/checkout/sales/[id]/void/route"
import { POST as cancel } from "@/app/api/checkout/sales/[id]/cancel/route"

const at = new Date("2026-10-24T12:00:00Z")
const input = { reason: "Comanda duplicada", expectedVersion: 0 }
const route = (id = "sale") => ({ params: Promise.resolve({ id }) })
function request(body: unknown = input, key: string | null = "void-request-key") {
  return new Request("http://test/api/checkout/sales/sale/void", {
    method: "POST", headers: { "Content-Type": "application/json", ...(key === null ? {} : { "Idempotency-Key": key }) }, body: JSON.stringify(body),
  })
}
function expectNoFinancialWrites() {
  for (const delegate of [db.payment, db.cashMovement, db.cashSession, db.inventoryMovement, db.inventoryBalance, db.commissionEntry, db.saleTip]) {
    for (const operation of ["create", "createMany", "update", "updateMany"] as const) expect(delegate[operation]).not.toHaveBeenCalled()
  }
}
beforeEach(() => {
  setupCheckout(); session.mockResolvedValue(owner.session)
  db.sale.findFirstOrThrow.mockResolvedValue(sale({ status: "VOIDED", version: 1, voidedAt: at, voidReason: input.reason, voidedBy: { nameSnapshot: "Operador" } }))
})

describe("Descarte Checkout: contrato HTTP e autorização", () => {
  it.each([null, { ...owner.session, barbershopId: null }, { ...owner.session, tenantRole: null }])("bloqueia ausência de sessão/tenant/papel antes da transação", async value => {
    session.mockResolvedValue(value)
    expect((await discard(request(), route())).status).toBe(value === null ? 401 : 403)
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.checkoutActor.create).not.toHaveBeenCalled()
  })
  it.each(["BARBERSHOP_OWNER", "ASSISTANT", "BARBER"] as const)("%s descarta no escopo permitido, sem lançamentos financeiros", async tenantRole => {
    session.mockResolvedValue(tenantRole === "BARBERSHOP_OWNER" ? owner.session : role(tenantRole).session)
    const response = await discard(request(), route()), body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(body).toMatchObject({ id: "sale", status: "VOIDED", closureKind: "VOIDED", version: 1, totalCents: 1000, finalizedAt: null, canceledAt: null, cancellationReason: null, voidedAt: at.toISOString(), voidReason: input.reason, voidedByName: "Operador", payments: [] })
    expect(body.items[0]).toMatchObject({ nameSnapshot: "Corte antigo", totalCents: 1000, quantity: 1 })
    expect(JSON.stringify(body)).not.toMatch(/barbershopId|voidedById|operatorId|password|requestHash|sessionVersion/)
    expect(db.sale.updateMany).toHaveBeenCalledWith({ where: { barbershopId: "shop", id: "sale", status: "PENDING", finalizedAt: null, version: 0 }, data: { status: "VOIDED", voidedAt: expect.any(Date), voidedById: "actor", voidReason: input.reason, version: { increment: 1 } } })
    expect(db.checkoutAuditEvent.create).toHaveBeenCalledWith({ data: { barbershopId: "shop", actorId: "actor", action: "sale.void", entity: "Sale", entityId: "sale", metadata: { idempotencyKey: "void-request-key" } } })
    expect(db.checkoutIdempotency.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ barbershopId: "shop", operation: "sale.void", key: "void-request-key", saleId: "sale", responseStatus: 200 }) }))
    expectNoFinancialWrites()
  })
  it("conta de profissional vinculada pela sessão descarta o próprio atendimento", async () => {
    session.mockResolvedValue({ type: "PROFESSIONAL", professionalId: "pro", globalRole: null, tenantRole: "BARBER", barbershopId: "shop", sessionVersion: 0 })
    expect((await discard(request(), route())).status).toBe(200)
    expect(db.professional.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "pro", barbershopId: "shop", status: "ACTIVE", userId: null, permissionLevel: "BARBER" } }))
    expectNoFinancialWrites()
  })
  it.each(["foreign", "mixed", "foreign-tip", "product-only"])("barbeiro não descarta comanda %s", async kind => {
    session.mockResolvedValue(role("BARBER").session)
    const row = sale()
    if (kind === "foreign") row.saleItem_sale[0].saleServiceComponent_saleItem[0].professionalId = "another"
    if (kind === "mixed") row.saleItem_sale[0].saleServiceComponent_saleItem.push({ ...serviceComponent(), id: "other-component", professionalId: "another" })
    if (kind === "foreign-tip") row.saleTip_sale = [{ professionalId: "another", professionalNameSnapshot: "Outro", amountCents: 100 }]
    if (kind === "product-only") row.saleItem_sale[0].saleServiceComponent_saleItem = []
    db.sale.findFirst.mockResolvedValue(row)
    expect((await discard(request(), route())).status).toBe(403)
    expect(db.sale.updateMany).not.toHaveBeenCalled()
    expect(db.checkoutAuditEvent.create).not.toHaveBeenCalled()
    expectNoFinancialWrites()
  })
  it("revalida vínculo ativo do operador no serviço", async () => {
    db.barbershopUser.findFirst.mockResolvedValue(null)
    expect((await discard(request(), route())).status).toBe(403)
    expect(db.sale.findFirst).not.toHaveBeenCalled()
    expect(db.sale.updateMany).not.toHaveBeenCalled()
  })
  it("venda de outro tenant é 404 e o lock usa exclusivamente tenant da sessão", async () => {
    db.$queryRaw.mockResolvedValue([])
    expect((await discard(request(), route("foreign-sale"))).status).toBe(404)
    expect((db.$queryRaw.mock.calls[0][0] as { values: unknown[] }).values).toEqual(["shop", "foreign-sale"])
    expect(db.sale.updateMany).not.toHaveBeenCalled()
    expectNoFinancialWrites()
  })
  it.each(["barbershopId", "userId", "tenantRole", "operatorId", "voidedById", "voidedAt", "cashSessionId", "payments"])("não aceita %s fornecido pelo cliente", async field => {
    expect((await discard(request({ ...input, [field]: "forged" }), route())).status).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it.each([{}, { reason: input.reason }, { ...input, expectedVersion: -1 }, { ...input, expectedVersion: 0.5 }, { ...input, expectedVersion: "0" }, { ...input, expectedVersion: 2147483648 }, { ...input, reason: "" }, { ...input, reason: " \t\n " }, { ...input, reason: "\u200B\u200C\u200D\uFEFF" }, { ...input, reason: "a".repeat(501) }, { ...input, reason: null }])("rejeita versão ou motivo ausente/inválido antes da transação: %j", async body => {
    const response = await discard(request(body), route())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ message: "Parâmetros inválidos." })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it("normaliza Unicode e espaços do motivo no servidor antes da auditoria/idempotência", async () => {
    const response = await discard(request({ ...input, reason: " \u200BＣomanda\u00a0\u00a0duplicada\n " }), route())
    expect(response.status).toBe(200)
    expect(db.sale.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ voidReason: "Comanda duplicada" }) }))
    expectNoFinancialWrites()
  })
  it.each([null, "invalid key", "", "x".repeat(201)])("exige header de idempotência válido: %s", async key => {
    expect((await discard(request(input, key), route())).status).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it("ID inválido, JSON inválido e corpo excessivo não iniciam transação", async () => {
    expect((await discard(request(), route(""))).status).toBe(400)
    expect((await discard(new Request("http://test", { method: "POST", headers: { "Idempotency-Key": "key" }, body: "{" }), route())).status).toBe(400)
    expect((await discard(request({ ...input, reason: "a".repeat(65537) }), route())).status).toBe(413)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it.each(["DRAFT", "PAID", "VOIDED", "CANCELED"] as const)("%s não pode ser descartada por outra operação", async status => {
    db.sale.findFirst.mockResolvedValue(sale({ status, ...(status === "PAID" ? { finalizedAt: at } : {}) }))
    expect((await discard(request(), route())).status).toBe(409)
    expect(db.sale.updateMany).not.toHaveBeenCalled()
    expectNoFinancialWrites()
  })
  it("versão desatualizada retorna 409 sem efeito financeiro", async () => {
    expect((await discard(request({ ...input, expectedVersion: 1 }), route())).status).toBe(409)
    expect(db.sale.updateMany).not.toHaveBeenCalled()
    expectNoFinancialWrites()
  })
})

describe("Cancelamento Checkout: separação do descarte e erros HTTP seguros", () => {
  it.each(["PENDING", "VOIDED", "CANCELED"] as const)("%s não pode acionar cancelamento financeiro", async status => {
    db.sale.findFirst.mockResolvedValue(sale({ status }))
    expect((await cancel(request({ reason: "Cancelamento" }), route())).status).toBe(409)
    expect(db.sale.update).not.toHaveBeenCalled()
    expectNoFinancialWrites()
  })
  it.each(["ASSISTANT", "BARBER"] as const)("%s pode descartar comanda própria, mas não cancelar PAID", async tenantRole => {
    session.mockResolvedValue(role(tenantRole).session)
    db.sale.findFirst.mockResolvedValue(sale({ status: "PAID", finalizedAt: at }))
    expect((await cancel(request({ reason: "Cancelamento" }), route())).status).toBe(403)
    expect(db.$transaction).not.toHaveBeenCalled()
    expectNoFinancialWrites()
  })
  it("proprietário cancela PAID com reversão de pagamento/comissão e DTO CANCELED", async () => {
    const paid = sale({ status: "PAID", finalizedAt: at, payment_sale: [{ id: "payment", method: "PIX", status: "RECORDED", appliedCents: 1000, cashReceivedCents: null, changeCents: 0, refundedCents: 0, recordedAt: at, refundedAt: null }] })
    db.sale.findFirst.mockResolvedValue(paid)
    db.commissionEntry.findMany.mockResolvedValue([{ id: "commission", componentId: "component", professionalId: "pro", status: "POSTED", baseCents: 1000, basisPoints: 4000, amountCents: 400 }])
    db.sale.findFirstOrThrow.mockResolvedValue(sale({ ...paid, status: "CANCELED", canceledAt: at, cancellationReason: "Lançamento incorreto", canceledBy: { nameSnapshot: "Proprietário" }, payment_sale: paid.payment_sale.map(payment => ({ ...payment, status: "REFUNDED", refundedCents: payment.appliedCents, refundedAt: at })) }))
    const response = await cancel(request({ reason: "Lançamento incorreto" }), route()), body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ status: "CANCELED", closureKind: "CANCELED", finalizedAt: at.toISOString(), canceledByName: "Proprietário", voidedAt: null, voidReason: null, payments: [{ status: "REFUNDED", refundedCents: 1000 }] })
    expect(db.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REFUNDED", refundedCents: 1000 }) }))
    expect(db.commissionEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "REVERSAL", reversalOfId: "commission", amountCents: 400 }) }))
    expect(db.checkoutAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "sale.cancel" }) }))
    expect(db.sale.updateMany).not.toHaveBeenCalled()
  })
  it.each([[knownError("P2010", "23514"), 409], [new Error("SECRET SQL tenant password constraint stack"), 500]] as const)("apresenta falha da persistência de forma segura", async (error, status) => {
    db.sale.updateMany.mockRejectedValue(error)
    const response = await discard(request(), route()), body = await response.json()
    expect(response.status).toBe(status)
    expect(body).toEqual({ message: status === 500 ? "Erro interno do servidor." : "A operação conflita com o estado atual dos dados." })
    expect(JSON.stringify(body)).not.toMatch(/SECRET|SQL|tenant|password|constraint|stack|Prisma|23514/)
    expect(db.checkoutAuditEvent.create).not.toHaveBeenCalled()
    expect(db.checkoutIdempotency.create).not.toHaveBeenCalled()
    expectNoFinancialWrites()
  })
})
