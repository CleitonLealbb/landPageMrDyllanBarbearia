import type { CheckoutClient } from "./client"
import { canAccess } from "@/lib/permissions"
import type { Context } from "./authorization"
import { balance } from "./cash"
import { sum } from "./calculations"
import { check } from "./errors"
import { json, presentSale, saleSelect } from "./presentation"
import { lockCash, lockSale, mutate } from "./transaction"
import type { CancelInput } from "./validation"

export function cancelSale(client: CheckoutClient, ctx: Context, key: string, id: string, input: CancelInput) {
  check(canAccess(ctx.session.tenantRole, "checkout:cancel"), 403, "Cancelamento exige proprietário.")
  return mutate(client, ctx, "sale.cancel", key, { id, ...input }, async (tx, actorId) => {
    const barbershopId = ctx.barbershopId
    if (input.cashSessionId) await lockCash(tx, barbershopId, input.cashSessionId)
    const sale = await lockSale(tx, barbershopId, id)
    check(sale.status === "PAID" && sale.finalizedAt !== null, 409, "Somente vendas finalizadas podem ser canceladas.")
    check(sale.payment_sale.every(payment => payment.status === "RECORDED" && payment.refundedCents === 0), 409, "Venda possui estorno anterior.")
    const cashTotal = sum(sale.payment_sale.filter(p => p.method === "CASH").map(p => p.appliedCents))
    if (cashTotal) {
      check(input.cashSessionId, 400, "Informe um caixa aberto para devolver dinheiro.")
      check(await balance(tx, barbershopId, input.cashSessionId) >= cashTotal, 409, "Saldo insuficiente para devolução.")
    }
    const productItems = sale.saleItem_sale.filter(i => i.kind === "PRODUCT")
    const components = sale.saleItem_sale.flatMap(i => i.saleServiceComponent_saleItem)
    const stock = await tx.inventoryMovement.findMany({ where: { barbershopId, saleItemId: { in: productItems.map(i => i.id) }, kind: "SALE" } })
    const commissions = await tx.commissionEntry.findMany({ where: { barbershopId, componentId: { in: components.map(c => c.id) }, kind: "EARNED" } })
    const cash = await tx.cashMovement.findMany({ where: { barbershopId, saleId: id, kind: "SALE" } })
    check(stock.length === productItems.length && productItems.every(item => stock.some(m => m.saleItemId === item.id && m.productId === item.productId && m.quantityDelta === -item.quantity)), 409, "Histórico de estoque incompleto.")
    check(commissions.length === components.length && commissions.every(c => c.status === "POSTED"), 409, "Histórico de comissão incompleto.")
    check(cash.length === sale.payment_sale.filter(p => p.method === "CASH").length && cash.every(m => sale.payment_sale.some(p => p.id === m.paymentId && p.method === "CASH" && p.appliedCents === m.amountCents)), 409, "Histórico de caixa incompleto.")
    // Cancellation must precede Payment UPDATE; snapshot totals remain unchanged.
    await tx.sale.update({ where: { barbershopId_id: { barbershopId, id } }, data: { status: "CANCELED", canceledById: actorId, canceledAt: new Date(), cancellationReason: input.reason, version: { increment: 1 } } })
    for (const movement of [...stock].sort((a, b) => a.productId.localeCompare(b.productId))) {
      const restored = await tx.inventoryBalance.updateMany({ where: { barbershopId, productId: movement.productId, quantity: { lte: 2147483647 + movement.quantityDelta } }, data: { quantity: { increment: -movement.quantityDelta }, version: { increment: 1 } } })
      check(restored.count === 1, 409, "Não foi possível restaurar o estoque.")
      await tx.inventoryMovement.create({ data: { barbershopId, productId: movement.productId, saleItemId: movement.saleItemId, actorId, kind: "REVERSAL", quantityDelta: -movement.quantityDelta, reversalOfId: movement.id, reason: input.reason } })
    }
    for (const commission of commissions) {
      await tx.commissionEntry.create({ data: { barbershopId, componentId: commission.componentId, professionalId: commission.professionalId, actorId, kind: "REVERSAL", baseCents: commission.baseCents, basisPoints: commission.basisPoints, amountCents: commission.amountCents, reversalOfId: commission.id } })
      await tx.commissionEntry.update({ where: { barbershopId_id: { barbershopId, id: commission.id } }, data: { status: "REVERSED" } })
    }
    for (const payment of sale.payment_sale) await tx.payment.update({ where: { barbershopId_id: { barbershopId, id: payment.id } }, data: { status: "REFUNDED", refundedCents: payment.appliedCents, refundedAt: new Date() } })
    for (const movement of cash) await tx.cashMovement.create({ data: { barbershopId, cashSessionId: input.cashSessionId!, saleId: id, paymentId: movement.paymentId, actorId, kind: "REVERSAL", amountCents: movement.amountCents, reversalOfId: movement.id, reason: input.reason } })
    const result = await tx.sale.findFirstOrThrow({ where: { barbershopId, id }, select: saleSelect })
    return { status: 200, body: json(presentSale(result)), saleId: id, entity: "Sale", entityId: id }
  })
}
