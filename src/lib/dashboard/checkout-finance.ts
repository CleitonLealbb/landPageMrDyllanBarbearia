import type { Prisma } from "@prisma/client"
import type { CheckoutFinance, CheckoutFinancePeriod } from "@/features/dashboard/types"

// Historical snapshots only. Never read current catalog prices or configured commission.
const saleSelect = {
  id: true, status: true, finalizedAt: true, canceledAt: true,
  totalCents: true, discountCents: true, tipCents: true,
  saleItem_sale: { where: { removedAt: null }, select: {
    kind: true, nameSnapshot: true, quantity: true, totalCents: true,
    saleServiceComponent_saleItem: { select: {
      professionalId: true, professionalNameSnapshot: true, allocatedGrossCents: true, allocatedDiscountCents: true,
      commissionEntry_component: { select: { kind: true, status: true, amountCents: true } },
    } },
  } },
  payment_sale: { select: { method: true, status: true, appliedCents: true, refundedCents: true } },
} satisfies Prisma.SaleSelect
export type FinanceSale = Prisma.SaleGetPayload<{ select: typeof saleSelect }>
type Range = { gte: Date; lt: Date }

function inRange(date: Date | null, range: Range) { return date !== null && date >= range.gte && date < range.lt }
function safeAdd(a: number, b: number) {
  const total = a + b
  if (!Number.isSafeInteger(total)) throw new Error("Financial aggregate exceeds safe integer range")
  return total
}

export function summarizeCheckout(paid: FinanceSale[], canceled: FinanceSale[], range: Range, timezone: string, professionalId: string | null): CheckoutFinancePeriod {
  const summary: CheckoutFinancePeriod = {
    paidTotalCents: 0, paidSales: 0, averageTicketCents: 0, servicesRevenueCents: 0, productsRevenueCents: 0,
    discountsCents: 0, tipsCents: 0, postedCommissionsCents: 0, commissionReversalsCents: 0,
    canceledSales: 0, canceledAmountCents: 0, refundedPaymentCents: 0, productsQuantity: 0, servicesQuantity: 0,
    payments: (["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD"] as const).map(method => ({ method, appliedCents: 0, sales: 0 })),
    daily: [], ranking: [], professionals: [],
  }
  const daily = new Map<string, CheckoutFinancePeriod["daily"][number]>()
  const ranking = new Map<string, CheckoutFinancePeriod["ranking"][number]>()
  const professionals = new Map<string, CheckoutFinancePeriod["professionals"][number]>()
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
  const seenPaid = new Set<string>(), seenCanceled = new Set<string>()
  for (const sale of paid) {
    if (sale.status !== "PAID" || !inRange(sale.finalizedAt, range) || seenPaid.has(sale.id)) continue
    seenPaid.add(sale.id)
    summary.paidSales++
    summary.paidTotalCents = safeAdd(summary.paidTotalCents, sale.totalCents)
    summary.discountsCents = safeAdd(summary.discountsCents, sale.discountCents)
    summary.tipsCents = safeAdd(summary.tipsCents, sale.tipCents)
    const day = dateFormatter.format(sale.finalizedAt!)
    const point = daily.get(day) ?? { date: day, paidTotalCents: 0, sales: 0 }
    point.paidTotalCents = safeAdd(point.paidTotalCents, sale.totalCents); point.sales++; daily.set(day, point)
    for (const item of sale.saleItem_sale) {
      if (item.kind === "PRODUCT") {
        summary.productsRevenueCents = safeAdd(summary.productsRevenueCents, item.totalCents)
        summary.productsQuantity = safeAdd(summary.productsQuantity, item.quantity)
      } else {
        summary.servicesRevenueCents = safeAdd(summary.servicesRevenueCents, item.totalCents)
        summary.servicesQuantity = safeAdd(summary.servicesQuantity, item.saleServiceComponent_saleItem.length)
      }
      const key = `${item.kind}:${item.nameSnapshot}`
      const row = ranking.get(key) ?? { kind: item.kind, name: item.nameSnapshot, quantity: 0, revenueCents: 0 }
      row.quantity = safeAdd(row.quantity, item.quantity); row.revenueCents = safeAdd(row.revenueCents, item.totalCents); ranking.set(key, row)
      for (const component of item.saleServiceComponent_saleItem) {
        if (professionalId && component.professionalId !== professionalId) continue
        const pro = professionals.get(component.professionalId) ?? { id: component.professionalId, name: component.professionalNameSnapshot, services: 0, servicesRevenueCents: 0, postedCommissionsCents: 0 }
        pro.services++
        pro.servicesRevenueCents = safeAdd(pro.servicesRevenueCents, component.allocatedGrossCents - component.allocatedDiscountCents)
        for (const entry of component.commissionEntry_component) if (entry.kind === "EARNED" && entry.status === "POSTED") {
          summary.postedCommissionsCents = safeAdd(summary.postedCommissionsCents, entry.amountCents)
          pro.postedCommissionsCents = safeAdd(pro.postedCommissionsCents, entry.amountCents)
        }
        professionals.set(pro.id, pro)
      }
    }
    const methods = new Set<string>()
    for (const payment of sale.payment_sale) {
      if (payment.status === "REFUNDED") continue
      const active = Math.max(0, payment.appliedCents - payment.refundedCents)
      if (!active) continue
      const method = summary.payments.find(row => row.method === payment.method)!
      method.appliedCents = safeAdd(method.appliedCents, active)
      if (!methods.has(method.method)) { method.sales++; methods.add(method.method) }
    }
  }
  for (const sale of canceled) {
    if (sale.status !== "CANCELED" || sale.finalizedAt === null || !inRange(sale.canceledAt, range) || seenCanceled.has(sale.id)) continue
    seenCanceled.add(sale.id)
    summary.canceledSales++
    summary.canceledAmountCents = safeAdd(summary.canceledAmountCents, sale.totalCents)
    for (const payment of sale.payment_sale) summary.refundedPaymentCents = safeAdd(summary.refundedPaymentCents, payment.refundedCents)
    for (const item of sale.saleItem_sale) for (const component of item.saleServiceComponent_saleItem) {
      if (professionalId && component.professionalId !== professionalId) continue
      for (const entry of component.commissionEntry_component) if (entry.kind === "REVERSAL" && entry.status === "POSTED") summary.commissionReversalsCents = safeAdd(summary.commissionReversalsCents, entry.amountCents)
    }
  }
  summary.averageTicketCents = summary.paidSales ? Math.round(summary.paidTotalCents / summary.paidSales) : 0
  summary.daily = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))
  summary.ranking = [...ranking.values()].sort((a, b) => b.revenueCents - a.revenueCents || a.name.localeCompare(b.name))
  summary.professionals = [...professionals.values()].sort((a, b) => b.servicesRevenueCents - a.servicesRevenueCents || a.name.localeCompare(b.name))
  return summary
}

export async function checkoutFinance(client: Prisma.TransactionClient, barbershopId: string, period: { current: Range; previous: Range; timezone: string; compare: boolean }, professionalId: string | null): Promise<CheckoutFinance> {
  const cohort: Prisma.SaleWhereInput = professionalId ? { saleItem_sale: { some: { barbershopId, removedAt: null, saleServiceComponent_saleItem: { some: { barbershopId, professionalId } } } } } : {}
  const read = (status: "PAID" | "CANCELED", range: Range) => client.sale.findMany({
    where: { barbershopId, status, ...(status === "PAID" ? { finalizedAt: range } : { canceledAt: range, finalizedAt: { not: null } }), ...cohort },
    select: saleSelect,
  })
  const paid = await read("PAID", period.current), canceled = await read("CANCELED", period.current)
  const current = summarizeCheckout(paid, canceled, period.current, period.timezone, professionalId)
  const previous = period.compare ? summarizeCheckout(await read("PAID", period.previous), await read("CANCELED", period.previous), period.previous, period.timezone, professionalId) : null
  return { source: "CHECKOUT", scope: professionalId ? "SALES_WITH_PROFESSIONAL" : "TENANT", current, previous }
}
