import { Prisma } from "@prisma/client"
import { z } from "zod"
import { canAccess } from "@/lib/permissions"
import { identity, type Context } from "./authorization"
import { inTransaction, type CheckoutClient, type CheckoutDatabase } from "./client"
import { check } from "./errors"
import { json } from "./presentation"
import { mutate } from "./transaction"

// PostgreSQL TEXT has no length limit; cap the administrative label for usability.
const name = z.string().transform(value => value.trim()).pipe(z.string().min(1).max(80).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value)))
export const createRegisterSchema = z.object({ name }).strict()
export const updateRegisterSchema = z.object({ name: name.optional(), active: z.boolean().optional() }).strict().refine(value => value.name !== undefined || value.active !== undefined)
const fields = { id: true, name: true, active: true } satisfies Prisma.CashRegisterSelect
function owner(ctx: Context) { check(canAccess(ctx.session.tenantRole, "checkout:registers"), 403, "Acesso negado.") }

// Shared with session opening. Always lock register before inspecting active/OPEN.
export async function lockRegister(tx: CheckoutDatabase, ctx: Context, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "CashRegister" WHERE "barbershopId" = ${ctx.barbershopId} AND "id" = ${id} FOR UPDATE`)
  check(rows.length === 1, 404, "Caixa não encontrado.")
}
export function listRegisters(client: CheckoutClient, ctx: Context) {
  owner(ctx)
  return inTransaction(client, async tx => {
    await identity(tx, ctx)
    const rows = await tx.cashRegister.findMany({ where: { barbershopId: ctx.barbershopId }, orderBy: [{ name: "asc" }, { id: "asc" }], select: {
      ...fields, cashSession_cashRegister: { where: { barbershopId: ctx.barbershopId, status: "OPEN" }, take: 1, select: { id: true, status: true } },
    } })
    return { status: 200, body: { registers: rows.map(row => ({ id: row.id, name: row.name, active: row.active, hasOpenSession: row.cashSession_cashRegister.length > 0, openSession: row.cashSession_cashRegister[0] ?? null })) } }
  })
}
export function createRegister(client: CheckoutClient, ctx: Context, key: string, input: z.infer<typeof createRegisterSchema>) {
  owner(ctx)
  const data = createRegisterSchema.parse(input)
  return mutate(client, ctx, "cash_register.created", key, data, async tx => {
    const row = await tx.cashRegister.create({ data: { ...data, barbershopId: ctx.barbershopId, active: true }, select: fields })
    return { status: 201, body: json(row), entity: "CashRegister", entityId: row.id, audit: { after: json(row) } }
  })
}
export function updateRegister(client: CheckoutClient, ctx: Context, key: string, id: string, input: z.infer<typeof updateRegisterSchema>) {
  owner(ctx)
  const data = updateRegisterSchema.parse(input)
  const operation = data.active === undefined ? "cash_register.renamed" : data.active ? "cash_register.activated" : "cash_register.deactivated"
  return mutate(client, ctx, operation, key, { id, ...data }, async (tx, actorId) => {
    await lockRegister(tx, ctx, id)
    const before = await tx.cashRegister.findFirst({ where: { barbershopId: ctx.barbershopId, id }, select: fields })
    check(before, 404, "Caixa não encontrado.")
    if (data.active === false) check(!await tx.cashSession.findFirst({ where: { barbershopId: ctx.barbershopId, cashRegisterId: id, status: "OPEN" }, select: { id: true } }), 409, "Feche a sessão aberta antes de inativar este caixa.")
    const after = await tx.cashRegister.update({ where: { barbershopId_id: { barbershopId: ctx.barbershopId, id } }, data, select: fields })
    const audit = { before: json(before), after: json(after) }
    if (data.active !== undefined && data.name !== undefined && data.name !== before.name) await tx.checkoutAuditEvent.create({ data: { barbershopId: ctx.barbershopId, actorId, action: "cash_register.renamed", entity: "CashRegister", entityId: id, metadata: { ...audit, idempotencyKey: key } } })
    return { status: 200, body: json(after), entity: "CashRegister", entityId: id, audit }
  })
}
