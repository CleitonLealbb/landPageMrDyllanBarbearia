import { canAccess } from "@/lib/permissions"
import { ownOperation, type Context } from "./authorization"
import type { CheckoutClient } from "./client"
import { check } from "./errors"
import { json, presentSale, saleSelect } from "./presentation"
import { lockSale, mutate } from "./transaction"
import { voidSchema, type VoidInput } from "./validation"

// A pending order has snapshots, but no receipts or financial effects to reverse.
export function voidSale(client: CheckoutClient, ctx: Context, key: string, id: string, raw: VoidInput) {
  check(canAccess(ctx.session.tenantRole, "checkout:sales"), 403, "Acesso negado.")
  const input = voidSchema.parse(raw)
  return mutate(client, ctx, "sale.void", key, { id, ...input }, async (tx, actorId, who) => {
    const barbershopId = ctx.barbershopId
    const sale = await lockSale(tx, barbershopId, id)
    ownOperation(ctx, who, sale.saleItem_sale.flatMap(item => item.saleServiceComponent_saleItem), sale.saleTip_sale)
    check(sale.status === "PENDING" && sale.finalizedAt === null && sale.version === input.expectedVersion, 409, "Comanda encerrada ou versão desatualizada.")
    const stock = await tx.inventoryMovement.findMany({ where: { barbershopId, saleItem: { barbershopId, saleId: id } }, select: { id: true } })
    const commissions = await tx.commissionEntry.findMany({ where: { barbershopId, component: { barbershopId, saleItem: { barbershopId, saleId: id } } }, select: { id: true } })
    const cash = await tx.cashMovement.findMany({ where: { barbershopId, saleId: id }, select: { id: true } })
    check(sale.payment_sale.length === 0 && stock.length === 0 && commissions.length === 0 && cash.length === 0, 409, "Comanda possui lançamentos incompatíveis com descarte.")
    const updated = await tx.sale.updateMany({ where: { barbershopId, id, status: "PENDING", finalizedAt: null, version: input.expectedVersion }, data: {
      status: "VOIDED", voidedAt: new Date(), voidedById: actorId, voidReason: input.reason, version: { increment: 1 },
    } })
    check(updated.count === 1, 409, "Comanda alterada por outra operação.")
    const result = await tx.sale.findFirstOrThrow({ where: { barbershopId, id }, select: saleSelect })
    return { status: 200, body: json(presentSale(result)), saleId: id, entity: "Sale", entityId: id }
  })
}
