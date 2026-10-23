import type { CheckoutClient } from "./client"
import type { Context } from "./authorization"
import { ownOperation } from "./authorization"
import { balance } from "./cash"
import { payments, sum } from "./calculations"
import { check } from "./errors"
import { json, presentSale, saleSelect } from "./presentation"
import { reconcile } from "./reconciliation"
import { lockCash, lockSale, mutate } from "./transaction"
import type { FinalizeInput } from "./validation"

export function finalizeSale(client: CheckoutClient, ctx: Context, key: string, id: string, input: FinalizeInput) {
  return mutate(client, ctx, "sale.finalize", key, { id, ...input }, async (tx, actorId, who) => {
    const barbershopId = ctx.barbershopId
    // All operations lock cash before sale, then products in stable ID order.
    await lockCash(tx, barbershopId, input.cashSessionId)
    const sale = await lockSale(tx, barbershopId, id)
    ownOperation(ctx, who, sale.saleItem_sale.flatMap(i => i.saleServiceComponent_saleItem), sale.saleTip_sale)
    check(["DRAFT", "PENDING"].includes(sale.status) && sale.finalizedAt === null && sale.version === input.expectedVersion, 409, "Venda já finalizada, cancelada ou versão desatualizada.")
    check(sale.payment_sale.length === 0, 409, "Venda já possui pagamentos registrados.")
    reconcile(sale)
    const confirmed = payments(sale.totalCents, input.payments)
    sum([await balance(tx, barbershopId, input.cashSessionId), ...confirmed.filter(p => p.method === "CASH").map(p => p.appliedCents)])
    const products = sale.saleItem_sale.filter(i => i.kind === "PRODUCT")
    const productIds = [...new Set(products.map(i => i.productId!))].sort()
    for (const productId of productIds) {
      const quantity = sum(products.filter(i => i.productId === productId).map(i => i.quantity))
      const stock = await tx.inventoryBalance.updateMany({ where: { barbershopId, productId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity }, version: { increment: 1 } } })
      check(stock.count === 1, 409, "Estoque insuficiente.")
    }
    if (products.length) await tx.inventoryMovement.createMany({ data: products.map(item => ({ barbershopId, productId: item.productId!, saleItemId: item.id, actorId, kind: "SALE", quantityDelta: -item.quantity, reason: "Finalização de venda" })) })
    // Payment trigger permits INSERT only before finalization.
    for (const payment of confirmed) {
      const row = await tx.payment.create({ data: { ...payment, barbershopId, saleId: id, actorId }, select: { id: true } })
      if (payment.method === "CASH") await tx.cashMovement.create({ data: { barbershopId, cashSessionId: input.cashSessionId, saleId: id, paymentId: row.id, actorId, kind: "SALE", amountCents: payment.appliedCents, reason: "Recebimento de venda" } })
    }
    const updated = await tx.sale.updateMany({ where: { barbershopId, id, version: input.expectedVersion, status: { in: ["DRAFT", "PENDING"] }, finalizedAt: null }, data: { status: "PAID", cashSessionId: input.cashSessionId, finalizedAt: new Date(), version: { increment: 1 } } })
    check(updated.count === 1, 409, "Venda alterada por outra operação.")
    const components = sale.saleItem_sale.flatMap(item => item.saleServiceComponent_saleItem)
    if (components.length) await tx.commissionEntry.createMany({ data: components.map(component => ({ barbershopId, componentId: component.id, professionalId: component.professionalId, actorId, kind: "EARNED", baseCents: component.commissionBaseCents, basisPoints: component.commissionBasisPoints, amountCents: component.commissionCents })) })
    const result = await tx.sale.findFirstOrThrow({ where: { barbershopId, id }, select: saleSelect })
    return { status: 200, body: json(presentSale(result)), saleId: id, entity: "Sale", entityId: id }
  })
}
