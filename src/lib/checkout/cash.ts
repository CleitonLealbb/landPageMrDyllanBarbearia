import type { CheckoutClient } from "./client"
import type { CheckoutDatabase } from "./client"
import type { z } from "zod"
import type { Context } from "./authorization"
import { cashBalance, sum } from "./calculations"
import { check } from "./errors"
import { cashSelect, json } from "./presentation"
import { lockCash, mutate } from "./transaction"
import type { closeSchema, movementSchema, openSchema } from "./validation"

export async function balance(tx: CheckoutDatabase, barbershopId: string, cashSessionId: string) {
  const rows = await tx.cashMovement.groupBy({ by: ["kind"], where: { barbershopId, cashSessionId }, _sum: { amountCents: true } })
  check(rows.every(row => Number.isSafeInteger(row._sum.amountCents)), 422, "Saldo fora do limite permitido.")
  return cashBalance(rows.map(row => ({ kind: row.kind, amountCents: row._sum.amountCents! })))
}
export function openCash(client: CheckoutClient, ctx: Context, key: string, input: z.infer<typeof openSchema>) {
  return mutate(client, ctx, "cash.open", key, input, async (tx, actorId) => {
    check(await tx.cashRegister.findFirst({ where: { id: input.cashRegisterId, barbershopId: ctx.barbershopId, active: true }, select: { id: true } }), 404, "Caixa não encontrado.")
    check(!await tx.cashSession.findFirst({ where: { barbershopId: ctx.barbershopId, cashRegisterId: input.cashRegisterId, status: "OPEN" }, select: { id: true } }), 409, "Já existe sessão aberta neste caixa.")
    const session = await tx.cashSession.create({ data: { ...input, barbershopId: ctx.barbershopId, openedById: actorId }, select: cashSelect })
    await tx.cashMovement.create({ data: { barbershopId: ctx.barbershopId, cashSessionId: session.id, actorId, kind: "OPENING", amountCents: input.openingBalanceCents, reason: "Abertura de caixa" } })
    return { status: 201, body: json(session), entity: "CashSession", entityId: session.id }
  })
}
export async function currentCash(client: CheckoutClient, ctx: Context, cashRegisterId: string) {
  const session = await client.cashSession.findFirst({ where: { barbershopId: ctx.barbershopId, cashRegisterId, status: "OPEN" }, select: cashSelect })
  return { status: 200, body: json({ session }) }
}
export function moveCash(client: CheckoutClient, ctx: Context, key: string, input: z.infer<typeof movementSchema>) {
  return mutate(client, ctx, "cash.move", key, input, async (tx, actorId) => {
    await lockCash(tx, ctx.barbershopId, input.cashSessionId)
    const available = await balance(tx, ctx.barbershopId, input.cashSessionId)
    if (input.kind === "WITHDRAWAL") check(available >= input.amountCents, 409, "Saldo de caixa insuficiente.")
    else sum([available, input.amountCents])
    const row = await tx.cashMovement.create({ data: { ...input, barbershopId: ctx.barbershopId, actorId }, select: { id: true, kind: true, amountCents: true, cashSessionId: true, reason: true, createdAt: true } })
    return { status: 201, body: json(row), entity: "CashMovement", entityId: row.id }
  })
}
export function closeCash(client: CheckoutClient, ctx: Context, key: string, id: string, input: z.infer<typeof closeSchema>) {
  return mutate(client, ctx, "cash.close", key, { id, ...input }, async (tx, actorId) => {
    await lockCash(tx, ctx.barbershopId, id)
    const expectedBalanceCents = await balance(tx, ctx.barbershopId, id)
    const row = await tx.cashSession.update({ where: { barbershopId_id: { barbershopId: ctx.barbershopId, id } }, data: {
      status: "CLOSED", closedById: actorId, closedAt: new Date(), expectedBalanceCents, countedBalanceCents: input.countedBalanceCents,
      differenceCents: input.countedBalanceCents - expectedBalanceCents, notes: input.notes ?? null, version: { increment: 1 },
    }, select: cashSelect })
    return { status: 200, body: json(row), entity: "CashSession", entityId: id }
  })
}
