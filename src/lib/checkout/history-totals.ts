import type { PaymentMethod, SaleStatus } from "@prisma/client"

export const historyPaymentMethods: PaymentMethod[] = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD"]
function cents(value: number | null | undefined) {
  const result = value ?? 0
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Invalid history aggregate")
  return result
}
export function cashHistoryTotals(
  payments: { method: PaymentMethod; _sum: { appliedCents: number | null; refundedCents: number | null; cashReceivedCents: number | null; changeCents: number | null } }[],
  sales: { status: SaleStatus; _sum: { totalCents: number | null } }[],
) {
  const paymentTotals = historyPaymentMethods.map(method => {
    const group = payments.find(row => row.method === method)
    const appliedCents = cents(group?._sum.appliedCents), refundedCents = cents(group?._sum.refundedCents)
    return { method, appliedCents, refundedCents, netAppliedCents: cents(appliedCents - refundedCents) }
  })
  const cash = payments.find(row => row.method === "CASH")
  const cashReceivedCents = cents(cash?._sum.cashReceivedCents), cashChangeCents = cents(cash?._sum.changeCents)
  const currentlyPaidSalesTotalCents = cents(sales.find(row => row.status === "PAID")?._sum.totalCents)
  const canceledSalesTotalCents = cents(sales.find(row => row.status === "CANCELED")?._sum.totalCents)
  return { paymentTotals, cashReceivedCents, cashChangeCents, cashOriginalEffectCents: cents(cashReceivedCents - cashChangeCents),
    finalizedSalesTotalCents: cents(currentlyPaidSalesTotalCents + canceledSalesTotalCents), currentlyPaidSalesTotalCents, canceledSalesTotalCents }
}
