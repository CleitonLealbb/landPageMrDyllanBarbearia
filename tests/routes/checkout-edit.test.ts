import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, knownError, owner, role, sale, setupCheckout } from "../setup/checkout"
import { createCheckoutServices } from "@/lib/checkout/factory"
import { saleSelect } from "@/lib/checkout/presentation"
import type { CheckoutClient } from "@/lib/checkout/client"

const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: session }))
import { PATCH, GET } from "@/app/api/checkout/sales/[id]/route"

const input = { expectedVersion: 0, items: [{ kind: "SERVICE", catalogId: "service", quantity: 1, professionalId: "pro" }], tips: [] }
const params = { params: Promise.resolve({ id: "sale" }) }
function request(body: unknown = input, key: string | null = "edit-key") {
  return new Request("http://test/api/checkout/sales/sale", { method: "PATCH", headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) })
}
beforeEach(() => {
  setupCheckout(); session.mockResolvedValue(owner.session)
  db.payment.findMany.mockResolvedValue([])
  db.saleItem.updateMany.mockResolvedValue({ count: 1 }); db.saleTip.updateMany.mockResolvedValue({ count: 0 })
  db.sale.findFirstOrThrow.mockResolvedValue(sale({ version: 1 }))
})
function noFinancialWrites() {
  for (const delegate of [db.payment, db.inventoryMovement, db.inventoryBalance, db.cashMovement, db.cashSession, db.commissionEntry])
    for (const method of ["create", "createMany", "update", "updateMany"] as const) expect(delegate[method]).not.toHaveBeenCalled()
}
describe("Edição PENDING: contrato e segurança", () => {
  it.each(["BARBERSHOP_OWNER", "ASSISTANT", "BARBER"] as const)("%s edita no escopo sem efeitos financeiros", async tenantRole => {
    session.mockResolvedValue(tenantRole === "BARBERSHOP_OWNER" ? owner.session : role(tenantRole).session)
    const result = await PATCH(request(), params)
    expect(result.status).toBe(200); expect(result.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await result.json()).toMatchObject({ status: "PENDING", version: 1 })
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 })
    expect(db.saleItem.updateMany).toHaveBeenCalledWith({ where: { barbershopId: "shop", saleId: "sale", removedAt: null }, data: { removedAt: expect.any(Date), removedById: "actor", removedReason: "Revisão da comanda PENDING" } })
    expect(db.sale.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop", id: "sale", status: "PENDING", finalizedAt: null, version: 0 }, data: expect.objectContaining({ version: { increment: 1 } }) }))
    expect(db.checkoutAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "sale.edit", metadata: expect.objectContaining({ idempotencyKey: "edit-key", before: expect.objectContaining({ version: 0 }), after: expect.objectContaining({ version: 1 }) }) }) }))
    noFinancialWrites()
  })
  it("obtém lock antes de ler estado e versão", async () => {
    await PATCH(request(), params)
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.sale.findFirst.mock.invocationCallOrder[0])
    expect(db.sale.findFirst.mock.calls[0][0]).toEqual({ where: { id: "sale", barbershopId: "shop" }, select: saleSelect })
  })
  it.each(["PAID", "CANCELED", "VOIDED", "DRAFT"] as const)("recusa %s sem modificar snapshots", async status => {
    db.sale.findFirst.mockResolvedValue(sale({ status }))
    expect((await PATCH(request(), params)).status).toBe(409)
    expect(db.saleItem.updateMany).not.toHaveBeenCalled(); noFinancialWrites()
  })
  it("recusa expectedVersion desatualizada antes das alterações", async () => {
    db.sale.findFirst.mockResolvedValue(sale({ version: 2 }))
    expect((await PATCH(request(), params)).status).toBe(409); expect(db.saleItem.updateMany).not.toHaveBeenCalled()
  })
  it.each([{}, { ...input, expectedVersion: -1 }, { ...input, expectedVersion: 0.5 }, { ...input, items: [] }, { ...input, barbershopId: "other" }, { ...input, operatorId: "other" }, { ...input, role: "BARBERSHOP_OWNER" }])("recusa payload incompleto ou identidade do cliente", async body => {
    expect((await PATCH(request(body), params)).status).toBe(400); expect(db.saleItem.updateMany).not.toHaveBeenCalled()
  })
  it("exige idempotência", async () => { expect((await PATCH(request(input, null), params)).status).toBe(400) })
  it("exige sessão", async () => { session.mockResolvedValue(null); expect((await PATCH(request(), params)).status).toBe(401) })
  it("não encontra venda de outro tenant", async () => {
    db.$queryRaw.mockResolvedValue([]); expect((await PATCH(request(), params)).status).toBe(404); expect(db.saleItem.updateMany).not.toHaveBeenCalled()
  })
  it.each(["before", "after"])("barbeiro não edita profissional alheio na versão %s", async stage => {
    session.mockResolvedValue(role("BARBER").session)
    if (stage === "before") { const row = sale(); row.saleItem_sale[0].saleServiceComponent_saleItem[0].professionalId = "other"; db.sale.findFirst.mockResolvedValue(row) }
    else db.professional.findMany.mockResolvedValue([{ id: "other", name: "Outro", commission: 40, services: [{ serviceId: "service" }] }])
    const body = stage === "after" ? { ...input, items: [{ ...input.items[0], professionalId: "other" }] } : input
    expect((await PATCH(request(body), params)).status).toBe(403); expect(db.saleItem.updateMany).not.toHaveBeenCalled()
  })
  it.each(["ASSISTANT", "BARBER"] as const)("%s não aplica desconto", async tenantRole => {
    session.mockResolvedValue(role(tenantRole).session)
    expect((await PATCH(request({ ...input, discount: { kind: "FIXED", amountCents: 50 } }), params)).status).toBe(403)
  })
  it.each(["service", "product", "package", "customer", "professional"])("recusa referência inválida/inativa de %s", async kind => {
    let body: unknown = input
    if (kind === "service") db.service.findMany.mockResolvedValue([])
    if (kind === "product") { db.product.findMany.mockResolvedValue([]); body = { ...input, items: [{ kind: "PRODUCT", catalogId: "foreign", quantity: 1 }] } }
    if (kind === "package") { db.servicePackage.findMany.mockResolvedValue([]); body = { ...input, items: [{ kind: "PACKAGE", catalogId: "foreign", quantity: 1, components: [{ serviceId: "service", professionalId: "pro" }, { serviceId: "beard", professionalId: "pro" }] }] } }
    if (kind === "customer") { db.barbershopCustomer.findFirst.mockResolvedValue(null); body = { ...input, customerId: "foreign" } }
    if (kind === "professional") db.professional.findMany.mockResolvedValue([])
    expect((await PATCH(request(body), params)).status).toBe(400); expect(db.saleItem.updateMany).not.toHaveBeenCalled()
  })
  it.each(["payment", "inventoryMovement", "commissionEntry", "cashMovement"] as const)("detecta efeito financeiro anterior em %s, inclusive de snapshots retirados", async delegate => {
    db[delegate].findMany.mockResolvedValue([{ id: "effect" }])
    expect((await PATCH(request(), params)).status).toBe(409); expect(db.saleItem.updateMany).not.toHaveBeenCalled()
  })
  it("recalcula catálogo, duração, quantidade, cliente, descontos e gorjetas no servidor", async () => {
    const result = await PATCH(request({ ...input, customerId: "customer", items: [{ kind: "SERVICE", catalogId: "service", quantity: 1, professionalId: "pro" }, { kind: "PRODUCT", catalogId: "product", quantity: 2 }], discount: { kind: "PERCENT", basisPoints: 1000 }, tips: [{ professionalId: "pro", amountCents: 500 }] }), params)
    expect(result.status).toBe(200)
    expect(db.sale.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customerId: "customer", servicesSubtotalCents: 1000, productsSubtotalCents: 2000, discountCents: 300, tipCents: 500, totalCents: 3200 }) }))
    expect(db.saleItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "SERVICE", durationMinutesSnapshot: 30 }) }))
    expect(db.saleItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "PRODUCT", durationMinutesSnapshot: null, quantity: 2 }) }))
    expect(db.saleServiceComponent.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ commissionBaseCents: 900, commissionCents: 360 })] })
    noFinancialWrites()
  })
  it("desconto fixo maior que novo subtotal falha antes de retirar snapshots", async () => {
    expect((await PATCH(request({ ...input, discount: { kind: "FIXED", amountCents: 1001 } }), params)).status).toBe(400)
    expect(db.saleItem.updateMany).not.toHaveBeenCalled()
  })
  it("troca profissional habilitado e atualiza duração/comissão do catálogo em cada unidade", async () => {
    db.professional.findMany.mockResolvedValue([{ id: "other", name: "Maria", commission: 25, services: [{ serviceId: "service" }] }])
    db.service.findMany.mockResolvedValue([{ id: "service", name: "Corte atualizado", priceCents: 1200, durationMinutes: 45 }])
    const result = await PATCH(request({ ...input, items: [{ ...input.items[0], quantity: 2, professionalId: "other" }] }), params)
    expect(result.status).toBe(200)
    expect(db.saleItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ durationMinutesSnapshot: 45, unitPriceCents: 1200, quantity: 2, totalCents: 2400 }) }))
    expect(db.saleServiceComponent.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ professionalId: "other", professionalNameSnapshot: "Maria", unitOrdinal: 1, durationMinutesSnapshot: 45, commissionBasisPoints: 2500, commissionCents: 300 }),
      expect.objectContaining({ professionalId: "other", professionalNameSnapshot: "Maria", unitOrdinal: 2, durationMinutesSnapshot: 45, commissionBasisPoints: 2500, commissionCents: 300 }),
    ] })
    noFinancialWrites()
  })
  it.each(["P2004", "P2034"])("traduz %s para 409 sem detalhes internos", async code => {
    db.saleItem.create.mockRejectedValue(knownError(code))
    const response = await PATCH(request(), params); expect(response.status).toBe(409)
    expect(JSON.stringify(await response.json())).not.toMatch(/SECRET|SQL|password|constraint|stack|Prisma/)
  })
  it("falha desconhecida continua 500 genérico", async () => {
    db.saleItem.create.mockRejectedValue(new Error("SECRET SQL"))
    const response = await PATCH(request(), params); expect(response.status).toBe(500); expect(await response.json()).toEqual({ message: "Erro interno do servidor." })
  })
  it("GET de consulta permanece disponível", async () => { expect((await GET(new Request("http://test/api/checkout/sales/sale"), params)).status).toBe(200) })
  it("autorização também existe no serviço injetado", async () => {
    expect(() => createCheckoutServices(db as unknown as CheckoutClient).editSale(role("ASSISTANT"), "key", "sale", { ...input, items: [{ kind: "SERVICE", catalogId: "service", professionalId: "pro", quantity: 1 }], discount: { kind: "FIXED", amountCents: 10 } })).toThrow("Desconto manual exige proprietário.")
  })
})
