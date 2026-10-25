import { createHash } from "node:crypto"
import { z } from "zod"
import { dashboardPeriod } from "@/lib/dashboard/period"
import { check } from "./errors"
import type { Context } from "./authorization"

const id = z.string().trim().min(1).max(100)
const cursorSchema = z.object({ at: z.iso.datetime(), id, scope: z.string().regex(/^[a-f0-9]{64}$/) }).strict()
export function historyQuery(params: URLSearchParams, resource: "sales" | "cash-sessions" | "movements") {
  const allowed = resource === "movements" ? ["pageSize", "cursor"] : ["period", "start", "end", "status", "customerId", "professionalId", "customerQuery", "professionalQuery", "cashSessionId", "cashRegisterId", "dateField", "pageSize", "cursor"]
  for (const key of params.keys()) check(allowed.includes(key) && params.getAll(key).length === 1, 400, "Parâmetro inválido.")
  const size = params.get("pageSize") ?? "20"
  check(/^[1-9]\d?$/.test(size) && Number(size) <= 50, 400, "Página deve conter entre 1 e 50 registros.")
  const status = params.get("status")
  check(!params.has("status") || (resource === "sales" ? ["DRAFT", "PENDING", "PAID", "VOIDED", "CANCELED"] : ["OPEN", "CLOSED"]).includes(status!), 400, "Estado inválido.")
  const identifiers = Object.fromEntries(["customerId", "professionalId", "cashSessionId", "cashRegisterId"].filter(key => params.has(key)).map(key => [key, id.parse(params.get(key))])) as Partial<Record<"customerId" | "professionalId" | "cashSessionId" | "cashRegisterId", string>>
  check(resource !== "sales" || !identifiers.cashRegisterId, 400, "Filtro não disponível para vendas.")
  check(resource !== "cash-sessions" || !identifiers.cashSessionId, 400, "Filtro não disponível para caixas.")
  const dateField = params.get("dateField") ?? (resource === "sales" ? "createdAt" : "openedAt")
  check((resource === "sales" ? ["createdAt", "finalizedAt", "voidedAt", "canceledAt"] : ["openedAt", "closedAt"]).includes(dateField), 400, "Data de referência inválida.")
  const rawCursor = params.get("cursor")
  check(rawCursor === null || (rawCursor.length > 0 && rawCursor.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(rawCursor)), 400, "Cursor inválido.")
  let cursor: z.infer<typeof cursorSchema> | null = null
  if (rawCursor) {
    try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"))) }
    catch { check(false, 400, "Cursor inválido.") }
  }
  const search = (key: string) => {
    if (!params.has(key)) return undefined
    const value = params.get(key)!.normalize("NFKC").trim().replace(/\s+/g, " ")
    return z.string().min(2).max(80).parse(value)
  }
  return { pageSize: Number(size), status, ...identifiers, customerQuery: search("customerQuery"), professionalQuery: search("professionalQuery"), dateField, cursor }
}
export function historyPeriod(params: URLSearchParams, timezone: string) {
  const periodParams = new URLSearchParams()
  for (const key of ["period", "start", "end"]) if (params.has(key)) periodParams.set(key, params.get(key)!)
  try { return dashboardPeriod(periodParams, timezone) }
  catch { check(false, 400, "Período inválido. Use datas válidas e intervalo de até 366 dias.") }
}
export function pageScope(ctx: Context, resource: string, params: URLSearchParams) {
  const filters = [...params.entries()].filter(([key]) => key !== "cursor").sort(([a], [b]) => a.localeCompare(b))
  return createHash("sha256").update(JSON.stringify([ctx.barbershopId, ctx.session.type, ctx.session.type === "USER" ? ctx.session.userId : ctx.session.professionalId, ctx.session.tenantRole, resource, filters])).digest("hex")
}
export function pageResult<T extends { id: string }>(rows: T[], pageSize: number, scope: string, at: (row: T) => Date) {
  const items = rows.slice(0, pageSize), last = items.at(-1), hasMore = rows.length > pageSize
  return { items, pageSize, hasMore, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ at: at(last).toISOString(), id: last.id, scope })).toString("base64url") : null }
}
