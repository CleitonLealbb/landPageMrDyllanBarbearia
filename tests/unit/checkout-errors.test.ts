import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"
import { ZodError } from "zod"
import { CheckoutError, errorResponse, isConflict } from "@/lib/checkout/errors"

function envelope(code: string, rust = false) {
  return `ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: ${rust ? `SqlState(E${code})` : `"${code}"`}, message: "SECRET SQL constraint foo table bar column baz password", severity: "ERROR", detail: Some("SECRET row"), column: None, hint: None }), transient: false })`
}
const unknown = (message: string) => new Prisma.PrismaClientUnknownRequestError(message, { clientVersion: "6.6.0" })
const known = (code: string, rawCode?: string, message = "SECRET SQL") => new Prisma.PrismaClientKnownRequestError(message, { clientVersion: "6.6.0", code, meta: rawCode ? { code: rawCode } : undefined })
const integrity = { message: "A operação conflita com o estado atual dos dados." }
const conflict = { message: "Conflito de operação. Atualize os dados e tente novamente com a mesma chave de idempotência." }
const internal = { message: "Erro interno do servidor." }

describe("Checkout: SQLSTATE restrito na apresentação", () => {
  it.each(["23514", "23503", "23505", "23P01", "40001", "40P01"])("%s UnknownRequestError: dois formatos conhecidos retornam 409 sem detalhes", async code => {
    for (const rust of [false, true]) {
      const error = unknown(`\nInvalid prisma.operation() invocation:\nError occurred during query execution:\n${envelope(code, rust)}`)
      const response = errorResponse(error)
      expect(response.status).toBe(409)
      expect(await response.json()).toEqual(["23505", "40001", "40P01"].includes(code) ? conflict : integrity)
      expect(response.headers.get("Cache-Control")).toBe("private, no-store")
      // Presentation must not change mutate()'s transaction/replay classification.
      expect(isConflict(error)).toBe(false)
    }
  })
  it.each(["23514", "23503", "23505", "23P01", "40001", "40P01"])("P2010 estruturado/%s mantém 409", async code => {
    expect(errorResponse(known("P2010", code)).status).toBe(409)
  })
  it.each(["P2002", "P2003", "P2004", "P2025", "P2034"])("%s estruturado continua prioritário e seguro", async code => {
    const response = errorResponse(known(code))
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(["P2002", "P2034"].includes(code) ? conflict : integrity)
  })
  it("código estruturado de timeout prevalece sobre texto semelhante a constraint", async () => {
    const response = errorResponse(known("P2028", "23514", envelope("23514")))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ message: "Operação temporariamente indisponível. Tente novamente." })
  })
  it.each([
    "23514", "SQLSTATE 23514", 'SELECT \'23514\'', 'constraint_23514', '{"code":"23514"}',
    'PostgresError { code: "23514", message: "SECRET" }',
    'user input: ConnectorError(ConnectorError { code: "23514" })',
    envelope("235140"), envelope("X23514"), envelope("23p01"),
    envelope("23514").replace('kind: QueryError', 'kind: OtherError'),
    envelope("23514").replace('code: "23514"', 'code: " 23514"'),
    envelope("23514").replace('code: "23514"', 'code: SqlState(23514)'),
    envelope("23514").replace('severity: "ERROR"', 'severity: "NOTICE"'),
    `SELECT '${envelope("23514")}'`,
    `"${envelope("23514").replaceAll('"', '\\"')}"`,
    `${envelope("23514")}\n${envelope("23505")}`,
    envelope("XX000"), envelope("25P02"), envelope("55P03"),
  ])("Unknown sem envelope único suportado continua 500: %s", async message => {
    const response = errorResponse(unknown(message))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual(internal)
  })
  it("não interpreta envelope presente em Error comum ou código solto no meta", async () => {
    expect(errorResponse(new Error(envelope("23514"))).status).toBe(500)
    expect(errorResponse(Object.assign(unknown("SECRET unknown"), { code: "23514", meta: { code: "23514" } })).status).toBe(500)
    expect(errorResponse(known("P2999", "23514", envelope("23514"))).status).toBe(500)
  })
  it("preserva respostas de validação e autorização", async () => {
    expect(errorResponse(new SyntaxError("SECRET")).status).toBe(400)
    expect(errorResponse(new ZodError([])).status).toBe(400)
    const denied = errorResponse(new CheckoutError(403, "Acesso negado."))
    expect(denied.status).toBe(403)
    expect(await denied.json()).toEqual({ message: "Acesso negado." })
  })
})
