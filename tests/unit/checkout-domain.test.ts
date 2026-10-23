import { beforeEach, describe, expect, it } from "vitest"
import type { Prisma } from "@prisma/client"
import { openCash, currentCash, closeCash, moveCash } from "@/lib/checkout/production"
import { createSale, readSale } from "@/lib/checkout/production"
import { finalizeSale } from "@/lib/checkout/production"
import { cancelSale } from "@/lib/checkout/production"
import { createSaleSchema } from "@/lib/checkout/validation"
import { db, knownError, owner, productSale, role, sale, setupCheckout } from "../setup/checkout"

const serviceInput = () => createSaleSchema.parse({ items: [{ kind: "SERVICE", catalogId: "service", professionalId: "pro", quantity: 1 }] })
const finalizeInput = () => ({ cashSessionId: "cash", expectedVersion: 0, payments: [{ method: "CASH" as const, appliedCents: 1000, cashReceivedCents: 1500, confirmed: true as const }] })
beforeEach(setupCheckout)

describe("Checkout: caixa e permissões", () => {
  it("abre sessão e registra fundo inicial atomicamente", async () => {
    db.cashSession.findFirst.mockResolvedValue(null)
    await openCash(owner, "open", { cashRegisterId: "register", shift: "Manhã", openingBalanceCents: 5000 })
    expect(db.cashSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ barbershopId: "shop", openedById: "actor" }) }))
    expect(db.cashMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "OPENING", amountCents: 5000 }) }))
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 })
  })
  it("impede segunda abertura e caixa de outro tenant", async () => {
    await expect(openCash(owner, "open", { cashRegisterId: "register", shift: "Manhã", openingBalanceCents: 0 })).rejects.toMatchObject({ status: 409 })
    db.cashRegister.findFirst.mockResolvedValue(null)
    await expect(openCash(owner, "foreign", { cashRegisterId: "other", shift: "Manhã", openingBalanceCents: 0 })).rejects.toMatchObject({ status: 404 })
    expect(db.cashSession.create).not.toHaveBeenCalled()
  })
  it("consulta somente a sessão aberta do caixa e tenant", async () => {
    await currentCash(owner, "register")
    expect(db.cashSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop", cashRegisterId: "register", status: "OPEN" } }))
  })
  it.each(["SUPPLY", "WITHDRAWAL"] as const)("assistente pode registrar %s", async kind => {
    await moveCash(role("ASSISTANT"), kind, { cashSessionId: "cash", kind, amountCents: 500, reason: "Ajuste autorizado" })
    expect(db.cashMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind, actorId: "actor", barbershopId: "shop" }) }))
  })
  it("recusa sangria acima do saldo e movimento em caixa fechado", async () => {
    await expect(moveCash(owner, "withdraw", { cashSessionId: "cash", kind: "WITHDRAWAL", amountCents: 5001, reason: "Sangria" })).rejects.toMatchObject({ status: 409 })
    db.cashSession.findFirst.mockResolvedValue(null)
    await expect(moveCash(owner, "closed", { cashSessionId: "cash", kind: "SUPPLY", amountCents: 1, reason: "Suprimento" })).rejects.toMatchObject({ status: 409 })
    expect(db.cashMovement.create).not.toHaveBeenCalled()
  })
  it("fecha caixa com saldo esperado, contagem e diferença", async () => {
    await closeCash(owner, "close", "cash", { countedBalanceCents: 4900 })
    expect(db.cashSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CLOSED", expectedBalanceCents: 5000, countedBalanceCents: 4900, differenceCents: -100, closedById: "actor" }) }))
  })
  it("barbeiro não opera caixa nem cancela", async () => {
    await expect(moveCash(role("BARBER"), "key", { cashSessionId: "cash", kind: "SUPPLY", amountCents: 1, reason: "Suprimento" })).rejects.toMatchObject({ status: 403 })
    expect(() => cancelSale(role("BARBER"), "key", "sale", { reason: "Cancelamento" })).toThrow()
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe("Checkout: criação e snapshots", () => {
  it("cria venda anônima com snapshots por unidade, sem baixar estoque", async () => {
    await createSale(owner, "new", serviceInput())
    expect(db.sale.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customerId: null, status: "PENDING", totalCents: 1000 }) }))
    expect(db.saleItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ durationMinutesSnapshot: 30, nameSnapshot: "Corte", unitPriceCents: 1000 }) }))
    expect(db.saleServiceComponent.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ durationMinutesSnapshot: 30, professionalNameSnapshot: "André", commissionBasisPoints: 4000, commissionCents: 400 })] })
    expect(db.inventoryBalance.updateMany).not.toHaveBeenCalled()
    expect(db.payment.create).not.toHaveBeenCalled()
  })
  it("produto mantém duração null e não cria componentes", async () => {
    await createSale(owner, "product", createSaleSchema.parse({ items: [{ kind: "PRODUCT", catalogId: "product", quantity: 2 }] }))
    expect(db.saleItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ durationMinutesSnapshot: null, subtotalCents: 2000 }) }))
    expect(db.saleServiceComponent.createMany).not.toHaveBeenCalled()
  })
  it("combo congela composição, duração e rateia preço/desconto antes da comissão", async () => {
    await createSale(owner, "combo", createSaleSchema.parse({ items: [{ kind: "PACKAGE", catalogId: "package", quantity: 2, components: [{ serviceId: "service", professionalId: "pro" }, { serviceId: "beard", professionalId: "pro" }] }], discount: { kind: "FIXED", amountCents: 202 }, tips: [{ professionalId: "pro", amountCents: 100 }] }))
    expect(db.saleItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ durationMinutesSnapshot: 50, subtotalCents: 2002, originalUnitPriceCents: 1500, totalCents: 1800 }) }))
    const call = db.saleServiceComponent.createMany.mock.calls[0][0] as { data: { allocatedGrossCents: number; commissionBaseCents: number; commissionCents: number; durationMinutesSnapshot: number }[] }
    expect(call.data.map(c => c.allocatedGrossCents)).toEqual([667, 334, 667, 334])
    expect(call.data.map(c => c.durationMinutesSnapshot)).toEqual([30, 20, 30, 20])
    expect(call.data.reduce((total, c) => total + c.commissionBaseCents, 0)).toBe(1800)
    expect(db.sale.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalCents: 1900, tipCents: 100 }) }))
  })
  it("aplica percentual inteiro e deixa gorjeta fora da base", async () => {
    await createSale(owner, "discount", { ...serviceInput(), discount: { kind: "PERCENT", basisPoints: 1000 }, tips: [{ professionalId: "pro", amountCents: 100 }] })
    expect(db.saleServiceComponent.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ commissionBaseCents: 900, commissionCents: 360 })] })
    expect(db.sale.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ discountCents: 100, totalCents: 1000, tipCents: 100 }) }))
  })
  it.each(["BARBER", "ASSISTANT"] as const)("%s não concede desconto manual", tenantRole => {
    expect(() => createSale(role(tenantRole), "discount", { ...serviceInput(), discount: { kind: "FIXED", amountCents: 1 } })).toThrow()
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it.each([null, 0, -1])("recusa serviço sem duração positiva: %s", async durationMinutes => {
    db.service.findMany.mockResolvedValue([{ id: "service", name: "Corte", priceCents: 1000, durationMinutes }])
    await expect(createSale(owner, "bad-duration", serviceInput())).rejects.toMatchObject({ status: 422 })
    expect(db.sale.create).not.toHaveBeenCalled()
  })
  it("barbeiro vende e lê somente componentes próprios", async () => {
    await createSale(role("BARBER"), "own", serviceInput())
    await readSale(role("BARBER"), "sale")
    db.professional.findFirst.mockResolvedValue({ id: "other" })
    await expect(createSale(role("BARBER"), "foreign", serviceInput())).rejects.toMatchObject({ status: 403 })
    await expect(readSale(role("BARBER"), "sale")).rejects.toMatchObject({ status: 403 })
  })
  it("revalida identidade profissional sem login de usuário", async () => {
    const ctx = { ...owner, session: { type: "PROFESSIONAL" as const, professionalId: "pro", globalRole: null, tenantRole: "BARBER" as const, barbershopId: "shop", sessionVersion: 0 } }
    await createSale(ctx, "own-professional", serviceInput())
    expect(db.professional.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "pro", userId: null, permissionLevel: "BARBER", barbershopId: "shop" }) }))
    expect(db.checkoutActor.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ identityType: "PROFESSIONAL", professionalId: "pro", userId: null }) }))
  })
  it("recusa referências de outro tenant e composição adulterada", async () => {
    db.service.findMany.mockResolvedValue([])
    await expect(createSale(owner, "foreign", serviceInput())).rejects.toMatchObject({ status: 400 })
    db.barbershopCustomer.findFirst.mockResolvedValue(null)
    await expect(createSale(owner, "customer", { ...serviceInput(), customerId: "other" })).rejects.toMatchObject({ status: 400 })
    expect(db.service.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ barbershopId: "shop" }) }))
  })
})

describe("Checkout: finalização", () => {
  it("pagamentos entram antes de PAID; snapshots históricos geram comissão", async () => {
    await finalizeSale(owner, "pay", "sale", finalizeInput())
    expect(db.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ appliedCents: 1000, cashReceivedCents: 1500, changeCents: 500, saleId: "sale", barbershopId: "shop" }) }))
    expect(db.cashMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amountCents: 1000, kind: "SALE" }) }))
    expect(db.payment.create.mock.invocationCallOrder[0]).toBeLessThan(db.sale.updateMany.mock.invocationCallOrder[0])
    expect(db.commissionEntry.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ amountCents: 400, basisPoints: 4000, baseCents: 1000 })] })
    expect(db.service.findMany).not.toHaveBeenCalled()
    expect(db.saleItem.update).not.toHaveBeenCalled()
    expect(db.saleServiceComponent.update).not.toHaveBeenCalled()
  })
  it("PIX e cartões não movimentam dinheiro físico", async () => {
    await finalizeSale(owner, "mixed", "sale", { ...finalizeInput(), payments: [{ method: "PIX", appliedCents: 500, confirmed: true }, { method: "CREDIT_CARD", appliedCents: 300, confirmed: true }, { method: "DEBIT_CARD", appliedCents: 200, confirmed: true }] })
    expect(db.payment.create).toHaveBeenCalledTimes(3)
    expect(db.cashMovement.create).not.toHaveBeenCalled()
  })
  it("baixa estoque de forma condicional e por tenant, agregando linhas do mesmo produto", async () => {
    const row = productSale(); row.saleItem_sale.push({ ...row.saleItem_sale[0], id: "item2" }); row.productsSubtotalCents = 2000; row.totalCents = 2000
    db.sale.findFirst.mockResolvedValue(row)
    await finalizeSale(owner, "stock", "sale", { ...finalizeInput(), payments: [{ method: "PIX", appliedCents: 2000, confirmed: true }] })
    expect(db.inventoryBalance.updateMany).toHaveBeenCalledOnce()
    expect(db.inventoryBalance.updateMany).toHaveBeenCalledWith({ where: { barbershopId: "shop", productId: "product", quantity: { gte: 2 } }, data: { quantity: { decrement: 2 }, version: { increment: 1 } } })
    expect(db.inventoryMovement.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ quantityDelta: -1 }), expect.objectContaining({ quantityDelta: -1 })] })
  })
  it("estoque insuficiente impede pagamento e finalização", async () => {
    db.sale.findFirst.mockResolvedValue(productSale()); db.inventoryBalance.updateMany.mockResolvedValue({ count: 0 })
    await expect(finalizeSale(owner, "stock", "sale", finalizeInput())).rejects.toMatchObject({ status: 409 })
    expect(db.payment.create).not.toHaveBeenCalled(); expect(db.sale.updateMany).not.toHaveBeenCalled()
  })
  it("caixa inexistente ou fechado impede finalização", async () => {
    db.$queryRaw.mockResolvedValueOnce([])
    await expect(finalizeSale(owner, "missing", "sale", finalizeInput())).rejects.toMatchObject({ status: 404 })
    db.cashSession.findFirst.mockResolvedValue(null)
    await expect(finalizeSale(owner, "closed", "sale", finalizeInput())).rejects.toMatchObject({ status: 409 })
    expect(db.payment.create).not.toHaveBeenCalled()
  })
  it.each(["PAID", "CANCELED"] as const)("não finaliza novamente venda %s", async status => {
    db.sale.findFirst.mockResolvedValue(sale({ status }))
    await expect(finalizeSale(owner, "again", "sale", finalizeInput())).rejects.toMatchObject({ status: 409 })
    expect(db.payment.create).not.toHaveBeenCalled()
  })
  it("recusa versão antiga e snapshot de duração ausente sem consultar catálogo", async () => {
    await expect(finalizeSale(owner, "old", "sale", { ...finalizeInput(), expectedVersion: 1 })).rejects.toMatchObject({ status: 409 })
    const row = sale(); row.saleItem_sale[0].saleServiceComponent_saleItem[0].durationMinutesSnapshot = null
    db.sale.findFirst.mockResolvedValue(row)
    await expect(finalizeSale(owner, "duration", "sale", finalizeInput())).rejects.toMatchObject({ status: 422 })
    expect(db.service.findMany).not.toHaveBeenCalled()
  })
  it("falha intermediária escapa da callback transacional sem auditoria/idempotência", async () => {
    db.commissionEntry.createMany.mockRejectedValue(new Error("ledger failure"))
    await expect(finalizeSale(owner, "failure", "sale", finalizeInput())).rejects.toThrow("ledger failure")
    expect(db.sale.updateMany).toHaveBeenCalledOnce()
    expect(db.checkoutAuditEvent.create).not.toHaveBeenCalled()
    expect(db.checkoutIdempotency.create).not.toHaveBeenCalled()
    // Real atomic rollback is delegated to Prisma, never caught inside the callback.
  })
})

describe("Checkout: cancelamento e reversões", () => {
  function paid() {
    const row = productSale()
    const service = sale().saleItem_sale[0]
    row.saleItem_sale.push({ ...service, id: "service-item" }); row.servicesSubtotalCents = 1000; row.totalCents = 2000
    row.status = "PAID"; row.finalizedAt = new Date(); row.cashSessionId = "old-closed-cash"
    row.payment_sale = [{ id: "payment", method: "CASH", status: "RECORDED", appliedCents: 2000, cashReceivedCents: 2500, changeCents: 500, refundedCents: 0, recordedAt: new Date(), refundedAt: null }]
    db.sale.findFirst.mockResolvedValue(row)
    db.inventoryMovement.findMany.mockResolvedValue([{ id: "stock", productId: "product", saleItemId: "item", quantityDelta: -1 }])
    db.commissionEntry.findMany.mockResolvedValue([{ id: "earned", componentId: "component", professionalId: "pro", status: "POSTED", baseCents: 1000, basisPoints: 4000, amountCents: 400 }])
    db.cashMovement.findMany.mockResolvedValue([{ id: "received", paymentId: "payment", amountCents: 2000 }])
  }
  it("cancela integralmente em outro caixa aberto e preserva os snapshots", async () => {
    paid()
    await cancelSale(owner, "cancel", "sale", { reason: "Solicitação do cliente", cashSessionId: "new-cash" })
    expect(db.sale.update.mock.invocationCallOrder[0]).toBeLessThan(db.payment.update.mock.invocationCallOrder[0])
    expect(db.commissionEntry.create.mock.invocationCallOrder[0]).toBeLessThan(db.commissionEntry.update.mock.invocationCallOrder[0])
    expect(db.inventoryMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: "REVERSAL", reversalOfId: "stock", quantityDelta: 1 }) })
    expect(db.commissionEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: "REVERSAL", reversalOfId: "earned", amountCents: 400 }) })
    expect(db.cashMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: "REVERSAL", reversalOfId: "received", cashSessionId: "new-cash", amountCents: 2000 }) })
    expect(db.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REFUNDED", refundedCents: 2000 }) }))
    expect(db.saleItem.update).not.toHaveBeenCalled(); expect(db.saleServiceComponent.update).not.toHaveBeenCalled()
  })
  it("cancela pendente sem exigir caixa nem criar reversões", async () => {
    await cancelSale(owner, "pending", "sale", { reason: "Desistência" })
    expect(db.sale.update).toHaveBeenCalledOnce()
    expect(db.inventoryMovement.create).not.toHaveBeenCalled(); expect(db.payment.update).not.toHaveBeenCalled()
  })
  it("segundo cancelamento e estorno sem caixa não criam reversões", async () => {
    db.sale.findFirst.mockResolvedValue(sale({ status: "CANCELED" }))
    await expect(cancelSale(owner, "twice", "sale", { reason: "Novamente" })).rejects.toMatchObject({ status: 409 })
    paid()
    await expect(cancelSale(owner, "no-cash", "sale", { reason: "Devolver" })).rejects.toMatchObject({ status: 400 })
    expect(db.inventoryMovement.create).not.toHaveBeenCalled()
  })
  it("saldo insuficiente e histórico incompleto abortam sem mutação", async () => {
    paid(); db.cashMovement.groupBy.mockResolvedValue([])
    await expect(cancelSale(owner, "no-funds", "sale", { cashSessionId: "cash", reason: "Devolver" })).rejects.toMatchObject({ status: 409 })
    db.cashMovement.groupBy.mockResolvedValue([{ kind: "OPENING", _sum: { amountCents: 5000 } }]); db.inventoryMovement.findMany.mockResolvedValue([])
    await expect(cancelSale(owner, "missing-ledger", "sale", { cashSessionId: "cash", reason: "Devolver" })).rejects.toMatchObject({ status: 409 })
    expect(db.sale.update).not.toHaveBeenCalled()
  })
})

describe("Checkout: idempotência transacional", () => {
  it.each(["finalize", "cancel"] as const)("repetição de %s não repete pagamentos ou reversões", async operation => {
    const run = () => operation === "finalize" ? finalizeSale(owner, "same", "sale", finalizeInput()) : cancelSale(owner, "same", "sale", { reason: "Desistência" })
    await run()
    const saved = db.checkoutIdempotency.create.mock.calls[0][0] as { data: object }
    db.checkoutIdempotency.findUnique.mockResolvedValue(saved.data)
    await run()
    expect(db.checkoutActor.create).toHaveBeenCalledOnce()
    expect(db.checkoutAuditEvent.create).toHaveBeenCalledOnce()
    expect(db.payment.create).toHaveBeenCalledTimes(operation === "finalize" ? 1 : 0)
    expect(db.sale.update).toHaveBeenCalledTimes(operation === "cancel" ? 1 : 0)
  })
  it("rollback do adaptador transacional desfaz baixa após falha de pagamento", async () => {
    const state = { stock: 2 }
    db.sale.findFirst.mockResolvedValue(productSale())
    db.inventoryBalance.updateMany.mockImplementation(async () => { state.stock--; return { count: 1 } })
    db.payment.create.mockRejectedValue(new Error("Falha intermediária"))
    db.$transaction.mockImplementation(async (...args: unknown[]) => {
      const original = structuredClone(state)
      try { return await (args[0] as (tx: Prisma.TransactionClient) => Promise<unknown>)(db as unknown as Prisma.TransactionClient) }
      catch (error) { Object.assign(state, original); throw error }
    })
    await expect(finalizeSale(owner, "rollback", "sale", finalizeInput())).rejects.toThrow("Falha intermediária")
    expect(db.inventoryBalance.updateMany).toHaveBeenCalledOnce()
    expect(state.stock).toBe(2)
    expect(db.checkoutIdempotency.create).not.toHaveBeenCalled()
    expect(db.sale.updateMany).not.toHaveBeenCalled()
  })
  it("reexecuta resposta sem repetir efeitos e vincula conteúdo/operador/tenant", async () => {
    await createSale(owner, "same-key", serviceInput())
    const created = db.checkoutIdempotency.create.mock.calls[0][0] as { data: { requestHash: string; result: object; responseStatus: number; saleId: string } }
    db.checkoutIdempotency.findUnique.mockResolvedValue(created.data)
    const replay = await createSale(owner, "same-key", serviceInput())
    expect(replay.status).toBe(201); expect(db.sale.create).toHaveBeenCalledOnce(); expect(db.checkoutActor.create).toHaveBeenCalledOnce()
    expect(db.checkoutIdempotency.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId_operation_key: { barbershopId: "shop", operation: "sale.create", key: "same-key" } } }))
    await expect(createSale(owner, "same-key", { ...serviceInput(), customerId: "customer" })).rejects.toMatchObject({ status: 409 })
    const other = { ...owner, barbershopId: "other-shop", session: { ...owner.session, barbershopId: "other-shop" } }
    db.checkoutIdempotency.findUnique.mockResolvedValue(null)
    await createSale(other, "same-key", serviceInput())
    expect(db.checkoutIdempotency.findUnique).toHaveBeenLastCalledWith(expect.objectContaining({ where: { barbershopId_operation_key: { barbershopId: "other-shop", operation: "sale.create", key: "same-key" } } }))
  })
  it("conflito de concorrência não repete trabalho financeiro", async () => {
    db.inventoryBalance.updateMany.mockRejectedValue(knownError("P2034")); db.sale.findFirst.mockResolvedValue(productSale())
    await expect(finalizeSale(owner, "conflict", "sale", finalizeInput())).rejects.toMatchObject({ code: "P2034" })
    expect(db.inventoryBalance.updateMany).toHaveBeenCalledOnce(); expect(db.payment.create).not.toHaveBeenCalled()
    expect(db.$transaction).toHaveBeenCalledTimes(2)
  })
})
