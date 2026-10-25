import type { CartLine, PaymentDraft } from "./types"

export class CheckoutInputError extends Error {}

export const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
export function amount(value: string): number {
  if (!/^\d{1,8}([,.]\d{1,2})?$/.test(value.trim())) throw new CheckoutInputError("Informe um valor válido com até duas casas decimais.")
  const [whole, decimal = ""] = value.trim().replace(",", ".").split(".")
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, "0"))
  if (result > 2147483647) throw new CheckoutInputError("Valor acima do limite permitido.")
  return result
}
export function estimate(lines: CartLine[], discountKind: "FIXED" | "PERCENT", discount: string, tip: string) {
  const subtotal = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0)
  const value = amount(discount || "0")
  if (discountKind === "PERCENT" && value > 10000) throw new CheckoutInputError("O desconto percentual deve ser de até 100%.")
  const reduction = discountKind === "PERCENT" ? Number((BigInt(subtotal) * BigInt(value) + BigInt(5000)) / BigInt(10000)) : value
  if (reduction > subtotal) throw new CheckoutInputError("Desconto maior que o subtotal.")
  const tipCents = amount(tip || "0")
  if (subtotal > 2147483647 || subtotal - reduction + tipCents > 2147483647) throw new CheckoutInputError("Total acima do limite permitido.")
  return { subtotal, discountCents: reduction, tipCents, totalCents: subtotal - reduction + tipCents }
}
export function paymentInput(payments: PaymentDraft[], total: number) {
  const result = payments.map(p => {
    const appliedCents = amount(p.amount)
    if (!appliedCents || !p.confirmed || p.reviewRequired) throw new CheckoutInputError("Confirme cada pagamento e informe valores positivos.")
    if (p.method !== "CASH") return { method: p.method, appliedCents, confirmed: true as const }
    const cashReceivedCents = amount(p.received)
    if (cashReceivedCents < appliedCents) throw new CheckoutInputError("Dinheiro recebido insuficiente.")
    return { method: p.method, appliedCents, cashReceivedCents, confirmed: true as const }
  })
  if (result.reduce((sum, p) => sum + p.appliedCents, 0) !== total) throw new CheckoutInputError("A soma dos pagamentos deve ser exatamente igual ao total da venda.")
  return result
}
export const methodLabel = { CASH: "Dinheiro", PIX: "PIX manual", DEBIT_CARD: "Cartão de débito manual", CREDIT_CARD: "Cartão de crédito manual" }
