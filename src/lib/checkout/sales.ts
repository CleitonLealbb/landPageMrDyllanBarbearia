import type { CheckoutClient } from "./client"
import { allowDiscount, identity, ownOperation, type Context } from "./authorization"
import { check } from "./errors"
import { json, presentSale, saleSelect } from "./presentation"
import { snapshots } from "./snapshots"
import { mutate } from "./transaction"
import type { CreateSaleInput } from "./validation"

export function createSale(client: CheckoutClient, ctx: Context, key: string, input: CreateSaleInput) {
  allowDiscount(ctx, input.discount)
  return mutate(client, ctx, "sale.create", key, input, async (tx, actorId, who) => {
    const { items, tips, ...totals } = await snapshots(tx, ctx, who, input)
    const barbershopId = ctx.barbershopId
    const sale = await tx.sale.create({ data: { ...totals, barbershopId, operatorId: actorId, customerId: input.customerId ?? null, status: "PENDING" }, select: { id: true } })
    for (const { components, ...item } of items) {
      const row = await tx.saleItem.create({ data: { ...item, barbershopId, saleId: sale.id }, select: { id: true } })
      if (components.length) await tx.saleServiceComponent.createMany({ data: components.map(component => ({ ...component, barbershopId, saleItemId: row.id })) })
    }
    if (tips.length) await tx.saleTip.createMany({ data: tips.map(tip => ({ ...tip, barbershopId, saleId: sale.id })) })
    const row = await tx.sale.findFirstOrThrow({ where: { barbershopId, id: sale.id }, select: saleSelect })
    return { status: 201, body: json(presentSale(row)), saleId: sale.id, entity: "Sale", entityId: sale.id }
  })
}

export async function readSale(client: CheckoutClient, ctx: Context, id: string) {
  const who = await identity(client, ctx)
  const sale = await client.sale.findFirst({ where: { barbershopId: ctx.barbershopId, id }, select: saleSelect })
  check(sale, 404, "Venda não encontrada.")
  ownOperation(ctx, who, sale.saleItem_sale.flatMap(item => item.saleServiceComponent_saleItem), sale.saleTip_sale)
  return { status: 200, body: json(presentSale(sale)) }
}
