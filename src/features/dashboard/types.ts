export type CheckoutFinancePeriod = {
  paidTotalCents: number; paidSales: number; averageTicketCents: number
  servicesRevenueCents: number; productsRevenueCents: number; discountsCents: number; tipsCents: number
  postedCommissionsCents: number; commissionReversalsCents: number
  canceledSales: number; canceledAmountCents: number; refundedPaymentCents: number
  productsQuantity: number; servicesQuantity: number
  payments: { method: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD"; appliedCents: number; sales: number }[]
  daily: { date: string; paidTotalCents: number; sales: number }[]
  ranking: { kind: "SERVICE" | "PACKAGE" | "PRODUCT"; name: string; quantity: number; revenueCents: number }[]
  professionals: { id: string; name: string; services: number; servicesRevenueCents: number; postedCommissionsCents: number }[]
}
export type CheckoutFinance = { source: "CHECKOUT"; scope: "TENANT" | "SALES_WITH_PROFESSIONAL"; current: CheckoutFinancePeriod; previous: CheckoutFinancePeriod | null }
export type DashboardSummary = {
  period: { start: string; end: string; timezone: string; previousStart: string; previousEnd: string }
  compare: boolean
  professionalId: string | null
  professionals: { id: string; name: string; commission: number }[]
  finance: CheckoutFinance
  metrics: { grossCents: number; netCents: null; appointments: null; averageTicketCents: number; servedCustomers: null; newCustomers: number | null; cancellations: null; occupancy: null; activeCustomers: number | null; previousNewCustomers: number | null }
}
