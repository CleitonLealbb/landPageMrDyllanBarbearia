import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { ZodError } from "zod"

export class CheckoutError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
export function check(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) throw new CheckoutError(status, message)
}
export function isConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  return ["P2002", "P2034"].includes(error.code) || (error.code === "P2010" && ["23505", "40001", "40P01", "55P03"].includes(String(error.meta?.code)))
}

// Prisma 6.6 can wrap PostgreSQL constraint errors in UnknownRequestError.
// Accept only the connector's Rust-debug envelope, never an incidental SQLSTATE
// in a query, constraint name, JSON, application message, or arbitrary Error.
function unknownPostgresState(error: unknown): string | undefined {
  if (!(error instanceof Prisma.PrismaClientUnknownRequestError)) return
  const envelopes = [...error.message.matchAll(/(?:^|\n)ConnectorError\(ConnectorError \{ user_facing_error: None, kind: QueryError\(PostgresError \{ code: (?:"([0-9A-Z]{5})"|SqlState\(E([0-9A-Z]{5})\)), message: "(?:[^"\\\r\n]|\\[^\r\n])*", severity: "ERROR", [^\r\n]* \}\), transient: (?:true|false) \}\)\r?(?=\n|$)/g)]
  if (envelopes.length === 1) return envelopes[0][1] ?? envelopes[0][2]
}
const integrityStates = new Set(["23514", "23503", "23P01"])
const retryStates = new Set(["23505", "40001", "40P01"])

export function errorResponse(error: unknown) {
  let status = 500, message = "Erro interno do servidor."
  const unknownState = unknownPostgresState(error)
  if (error instanceof CheckoutError) { status = error.status; message = error.message }
  else if (error instanceof ZodError || error instanceof SyntaxError) { status = 400; message = "Parâmetros inválidos." }
  else if (isConflict(error) || (unknownState !== undefined && retryStates.has(unknownState))) { status = 409; message = "Conflito de operação. Atualize os dados e tente novamente com a mesma chave de idempotência." }
  else if (unknownState !== undefined && integrityStates.has(unknownState)) { status = 409; message = "A operação conflita com o estado atual dos dados." }
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (["P2003", "P2004", "P2025"].includes(error.code) || (error.code === "P2010" && ["23503", "23514", "23P01", "22003"].includes(String(error.meta?.code)))) {
      status = 409; message = "A operação conflita com o estado atual dos dados."
    }
    if (["P1001", "P1002", "P2024", "P2028"].includes(error.code)) { status = 503; message = "Operação temporariamente indisponível. Tente novamente." }
  }
  return NextResponse.json({ message }, { status, headers: { "Cache-Control": "private, no-store" } })
}
