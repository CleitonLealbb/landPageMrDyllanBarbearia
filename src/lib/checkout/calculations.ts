import type { CashMovementKind } from "@prisma/client"
import type { z } from "zod"
import { check } from "./errors"
import { MAX_CENTS, type discountSchema, type paymentSchema } from "./validation"

export function integer(value: bigint | number) {
  check(typeof value === "bigint" || Number.isSafeInteger(value), 422, "Valor fora do limite permitido.")
  const n = typeof value === "bigint" ? value : BigInt(value)
  check(n >= BigInt(0) && n <= BigInt(MAX_CENTS), 422, "Valor fora do limite permitido.")
  return Number(n)
}
export const sum = (values: number[]) => integer(values.reduce((total, value) => total + BigInt(value), BigInt(0)))
export const multiply = (value: number, quantity: number) => integer(BigInt(value) * BigInt(quantity))
export const percentage = (base: number, points: number) => integer((BigInt(base) * BigInt(points) + BigInt(5000)) / BigInt(10000))
export function positiveDuration(value: number | null) {
  check(value !== null && Number.isInteger(value) && value > 0, 422, "Catálogo ou snapshot sem duração válida.")
  return value
}
export function commissionPoints(percent: number) {
  check(Number.isInteger(percent) && percent >= 0 && percent <= 100, 422, "Percentual de comissão inválido no cadastro.")
  return percent * 100
}
// Largest remainder, deterministic tie-break by input/catalog order. No floats.
export function allocate(total: number, weights: number[]) {
  const denominator = weights.reduce((sum, weight) => sum + BigInt(weight), BigInt(0))
  if (!total) return weights.map(() => 0)
  check(denominator > BigInt(0), 422, "Não há base para ratear o valor.")
  const rows = weights.map((weight, index) => ({ index, amount: Number(BigInt(total) * BigInt(weight) / denominator), remainder: BigInt(total) * BigInt(weight) % denominator }))
  let missing = total - rows.reduce((sum, row) => sum + row.amount, 0)
  const ordered = [...rows].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)
  for (const row of ordered) { if (!missing) break; row.amount++; missing-- }
  return rows.map(row => row.amount)
}
export function discountAmount(gross: number, discount?: z.infer<typeof discountSchema>) {
  const value = !discount ? 0 : discount.kind === "FIXED" ? discount.amountCents : percentage(gross, discount.basisPoints)
  check(value <= gross, 400, "Desconto não pode superar o subtotal.")
  return value
}
export function payments(total: number, rows: z.infer<typeof paymentSchema>[]) {
  const result = rows.map(row => {
    check(row.confirmed === true && Number.isInteger(row.appliedCents) && row.appliedCents > 0, 400, "Pagamento deve ser positivo e confirmado manualmente.")
    if (row.method !== "CASH") check(row.cashReceivedCents === undefined, 400, "Somente dinheiro admite valor recebido e troco.")
    else check(row.cashReceivedCents !== undefined && row.cashReceivedCents >= row.appliedCents, 400, "Valor recebido em dinheiro insuficiente.")
    return { method: row.method, appliedCents: row.appliedCents, cashReceivedCents: row.method === "CASH" ? row.cashReceivedCents! : null, changeCents: row.method === "CASH" ? row.cashReceivedCents! - row.appliedCents : 0 }
  })
  check(sum(result.map(row => row.appliedCents)) === total, 400, "Pagamentos devem corresponder exatamente ao total.")
  return result
}
export function cashBalance(rows: { kind: CashMovementKind; amountCents: number }[]) {
  return integer(rows.reduce((balance, row) => balance + BigInt(row.amountCents) * (["WITHDRAWAL", "REVERSAL"].includes(row.kind) ? -BigInt(1) : BigInt(1)), BigInt(0)))
}
