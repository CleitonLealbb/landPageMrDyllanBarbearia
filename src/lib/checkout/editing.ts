import { canAccess } from "@/lib/permissions"
import { allowDiscount, ownOperation, type Context } from "./authorization"
import type { CheckoutClient } from "./client"
import { check } from "./errors"
import { json, presentSale, saleSelect } from "./presentation"
import { snapshots } from "./snapshots"
import { lockSale, mutate } from "./transaction"
import { editSaleSchema, type EditSaleInput } from "./validation"

export function editSale(client: CheckoutClient, ctx: Context, key: string, id: string, raw: EditSaleInput) {
  check(canAccess(ctx.session.tenantRole, "checkout:sales"), 403, "Acesso negado.")
  const input = editSaleSchema.parse(raw)
  allowDiscount(ctx, input.discount)
  return mutate(client, ctx, "sale.edit", key, { id, ...input }, async (tx, actorId, who) => {
    const barbershopId = ctx.barbershopId
    const before = await lockSale(tx, barbershopId, id)
    ownOperation(ctx, who, before.saleItem_sale.flatMap(item => item.saleServiceComponent_saleItem), before.saleTip_sale)
    check(before.status === "PENDING" && before.finalizedAt === null && before.version === input.expectedVersion, 409, "Comanda encerrada ou versão desatualizada.")
    // Include every historical snapshot when checking financial effects.
    const [payments, cash, stock, commissions] = await Promise.all([
      tx.payment.findMany({ where: { barbershopId, saleId: id }, select: { id: true } }),
      tx.cashMovement.findMany({ where: { barbershopId, saleId: id }, select: { id: true } }),
      tx.inventoryMovement.findMany({ where: { barbershopId, saleItem: { barbershopId, saleId: id } }, select: { id: true } }),
      tx.commissionEntry.findMany({ where: { barbershopId, component: { barbershopId, saleItem: { barbershopId, saleId: id } } }, select: { id: true } }),
    ])
    check(!payments.length && !cash.length && !stock.length && !commissions.length && !before.payment_sale.length, 409, "Comanda possui lançamentos incompatíveis com edição.")
    // An assistant/barber cannot silently remove an owner's existing discount.
    check(canAccess(ctx.session.tenantRole, "checkout:discount") || before.discountKind === "NONE", 403, "Comanda com desconto manual exige proprietário para edição.")
    const { items, tips, ...totals } = await snapshots(tx, ctx, who, input)
    const removal = { removedAt: new Date(), removedById: actorId, removedReason: "Revisão da comanda PENDING" }
    await tx.saleItem.updateMany({ where: { barbershopId, saleId: id, removedAt: null }, data: removal })
    await tx.saleTip.updateMany({ where: { barbershopId, saleId: id, removedAt: null }, data: removal })
    for (const { components, ...item } of items) {
      const row = await tx.saleItem.create({ data: { ...item, barbershopId, saleId: id }, select: { id: true } })
      if (components.length) await tx.saleServiceComponent.createMany({ data: components.map(component => ({ ...component, barbershopId, saleItemId: row.id })) })
    }
    if (tips.length) await tx.saleTip.createMany({ data: tips.map(tip => ({ ...tip, barbershopId, saleId: id })) })
    const updated = await tx.sale.updateMany({ where: { barbershopId, id, status: "PENDING", finalizedAt: null, version: input.expectedVersion }, data: { ...totals, customerId: input.customerId ?? null, version: { increment: 1 } } })
    check(updated.count === 1, 409, "Comanda alterada por outra operação.")
    const after = await tx.sale.findFirstOrThrow({ where: { barbershopId, id }, select: saleSelect })
    return { status: 200, body: json(presentSale(after)), saleId: id, entity: "Sale", entityId: id,
      audit: json({ before: presentSale(before), after: presentSale(after), reason: removal.removedReason }) }
  })
}
