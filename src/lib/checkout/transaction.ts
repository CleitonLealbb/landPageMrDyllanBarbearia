import type { CheckoutClient } from "./client"
import { inTransaction } from "./client"
import type { CheckoutDatabase } from "./client"
import { createHash } from "node:crypto"
import { Prisma } from "@prisma/client"
import { canAccess } from "@/lib/permissions"
import { check, isConflict } from "./errors"
import { identity, ownOperation, type Context, type Identity } from "./authorization"
import { json, saleSelect } from "./presentation"

export type MutationResult = { status: number; body: Prisma.InputJsonObject; saleId?: string; entity: string; entityId: string; audit?: Prisma.InputJsonObject }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${JSON.stringify(key)}:${canonical(value)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}
const replaySelect = { requestHash: true, result: true, responseStatus: true, saleId: true } satisfies Prisma.CheckoutIdempotencySelect
export async function mutate(client: CheckoutClient, ctx: Context, operation: string, key: string, payload: unknown, work: (tx: CheckoutDatabase, actorId: string, who: Identity) => Promise<MutationResult>) {
  check(canAccess(ctx.session.tenantRole, operation.startsWith("cash.") ? "checkout:cash" : operation === "sale.cancel" ? "checkout:cancel" : "checkout:sales"), 403, "Acesso negado.")
  const session = ctx.session
  const principal = session.type === "USER" ? `USER:${session.userId}` : `PROFESSIONAL:${session.professionalId}`
  const hash = createHash("sha256").update(canonical({ operation, payload, principal })).digest("hex")
  const where = { barbershopId_operation_key: { barbershopId: ctx.barbershopId, operation, key } }
  async function replay(tx: CheckoutDatabase, row: Prisma.CheckoutIdempotencyGetPayload<{ select: typeof replaySelect }>, who: Identity) {
    check(row.requestHash === hash, 409, "Chave de idempotência já utilizada com outro conteúdo ou operador.")
    if (ctx.session.tenantRole === "BARBER") {
      check(row.saleId, 403, "Acesso negado.")
      const sale = await tx.sale.findFirst({ where: { id: row.saleId, barbershopId: ctx.barbershopId }, select: saleSelect })
      check(sale, 404, "Venda não encontrada.")
      ownOperation(ctx, who, sale.saleItem_sale.flatMap(item => item.saleServiceComponent_saleItem), sale.saleTip_sale)
    }
    return { status: row.responseStatus, body: row.result }
  }
  try {
    return await inTransaction(client, async tx => {
      const who = await identity(tx, ctx)
      const existing = await tx.checkoutIdempotency.findUnique({ where, select: replaySelect })
      if (existing) return replay(tx, existing, who)
      const snapshot = { identityType: who.identityType, userId: who.userId, professionalId: who.professionalId, nameSnapshot: who.nameSnapshot, roleSnapshot: who.roleSnapshot }
      const actor = await tx.checkoutActor.create({ data: { ...snapshot, barbershopId: ctx.barbershopId }, select: { id: true } })
      const result = await work(tx, actor.id, who)
      await tx.checkoutAuditEvent.create({ data: { barbershopId: ctx.barbershopId, actorId: actor.id, action: operation, entity: result.entity, entityId: result.entityId, metadata: { ...result.audit, idempotencyKey: key } } })
      await tx.checkoutIdempotency.create({ data: { barbershopId: ctx.barbershopId, actorId: actor.id, operation, key, requestHash: hash, responseStatus: result.status, result: json(result.body), saleId: result.saleId ?? null } })
      return { status: result.status, body: result.body }
    })
  } catch (error) {
    if (isConflict(error) && client.$transaction) {
      // A competing attempt has rolled back in full. Replay a completed winner;
      // otherwise return a controlled conflict, without retrying financial work.
      const result = await inTransaction(client, async tx => {
        const who = await identity(tx, ctx)
        const existing = await tx.checkoutIdempotency.findUnique({ where, select: replaySelect })
        return existing ? replay(tx, existing, who) : null
      }, 5000)
      if (result) return result
    }
    throw error
  }
}
export async function lockCash(tx: CheckoutDatabase, barbershopId: string, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "CashSession" WHERE "barbershopId" = ${barbershopId} AND "id" = ${id} FOR UPDATE`)
  check(rows.length === 1, 404, "Sessão de caixa não encontrada.")
  const session = await tx.cashSession.findFirst({ where: { id, barbershopId, status: "OPEN" }, select: { id: true } })
  check(session, 409, "Caixa deve estar aberto.")
}
export async function lockSale(tx: CheckoutDatabase, barbershopId: string, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "Sale" WHERE "barbershopId" = ${barbershopId} AND "id" = ${id} FOR UPDATE`)
  check(rows.length === 1, 404, "Venda não encontrada.")
  const sale = await tx.sale.findFirst({ where: { id, barbershopId }, select: saleSelect })
  check(sale, 404, "Venda não encontrada.")
  return sale
}
