import { amount, CheckoutInputError } from "./helpers"
import type { PaymentDraft } from "./types"

function parsed(value: string): number | null {
  try { return amount(value) } catch { return null }
}
function validTotal(total: number) { return Number.isSafeInteger(total) && total >= 0 && total <= 2147483647 }

// Formatting an integer amount never rounds or parses a floating-point value.
export function formatPaymentCents(cents: number): string {
  if (!validTotal(cents)) throw new CheckoutInputError("Informe um valor válido em centavos.")
  const value = BigInt(cents), hundred = BigInt(100)
  return `${value / hundred},${String(value % hundred).padStart(2, "0")}`
}

// The existing flow counts all applied amounts, independent of confirmation.
// An incomplete input must not become zero and silently change another payment.
export function paymentRemaining(payments: PaymentDraft[], total: number, id?: string): number | null {
  if (!validTotal(total)) return null
  let others = 0
  for (const payment of payments) {
    if (payment.id === id) continue
    const value = parsed(payment.amount)
    if (value === null) return null
    others += value
  }
  return Math.max(0, total - others)
}

export function paymentError(payments: PaymentDraft[], total: number, id: string): string | null {
  const payment = payments.find(row => row.id === id)
  if (!payment || !validTotal(total)) return "Confira o total confirmado da venda."
  const applied = parsed(payment.amount)
  if (applied === null) return "Informe um valor válido com até duas casas decimais."
  if (applied === 0) return "Informe um valor aplicado positivo; ajuste ou remova este pagamento."
  const remaining = paymentRemaining(payments, total, id)
  if (remaining === null) return "Confira os valores dos outros pagamentos antes de confirmar."
  if (applied > remaining) return payment.method === "CASH"
    ? "Valor aplicado excede o restante da venda. Informe o excedente somente em Dinheiro recebido."
    : "Valor aplicado excede o restante da venda. PIX e cartões não permitem troco."
  if (payment.method === "CASH") {
    const received = parsed(payment.received)
    if (received === null) return "Informe um valor válido em Dinheiro recebido."
    if (received < applied) return "Dinheiro recebido insuficiente para o valor aplicado."
  }
  return null
}

export function paymentSummary(payments: PaymentDraft[], total: number) {
  let appliedCents = 0, confirmedCents = 0, changeCents = 0
  for (const payment of payments) {
    const value = parsed(payment.amount)
    if (value === null) continue
    appliedCents += value
    if (payment.confirmed) confirmedCents += value
    if (payment.method === "CASH") {
      const received = parsed(payment.received)
      if (received !== null) changeCents += Math.max(0, received - value)
    }
  }
  return { appliedCents, confirmedCents, remainingCents: Math.max(0, total - appliedCents), excessCents: Math.max(0, appliedCents - total), changeCents,
    valid: validTotal(total) && payments.length <= 20 && payments.every(payment => paymentError(payments, total, payment.id) === null) }
}

export function syncPaymentRemainder(payments: PaymentDraft[], total: number): PaymentDraft[] {
  const last = payments.at(-1)
  const remaining = last?.amountMode === "AUTO" && !last.confirmed ? paymentRemaining(payments, total, last.id) : null
  return payments.map((payment, index) => {
    if (payment.confirmed) return payment
    const applied = index === payments.length - 1 && remaining !== null ? formatPaymentCents(remaining) : payment.amount
    const value = parsed(applied)
    const received = payment.method === "CASH" && payment.receivedMode === "AUTO" && value !== null ? formatPaymentCents(value) : payment.received
    return applied === payment.amount && received === payment.received ? payment : { ...payment, amount: applied, received }
  })
}
