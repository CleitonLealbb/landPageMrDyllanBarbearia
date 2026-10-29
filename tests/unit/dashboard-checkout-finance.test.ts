import { describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"
import { checkoutFinance, summarizeCheckout, type FinanceSale } from "@/lib/dashboard/checkout-finance"
import { dashboardPeriod } from "@/lib/dashboard/period"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DashboardFinance } from "@/features/dashboard/components/dashboard-finance"
import { DashboardMetrics } from "@/features/dashboard/components/dashboard-metrics"
import type { DashboardSummary } from "@/features/dashboard/types"

const period = dashboardPeriod(new URLSearchParams({ period: "custom", start: "2026-10-01", end: "2026-10-01", compare: "true" }), "America/Cuiaba")
function sale(): FinanceSale {
  const component = { professionalId: "pro", professionalNameSnapshot: "Profissional histórico", allocatedGrossCents: 7500, allocatedDiscountCents: 750, commissionEntry_component: [{ kind: "EARNED" as const, status: "POSTED" as const, amountCents: 2700 }] }
  return {
    id: "sale", status: "PAID", finalizedAt: new Date("2026-10-01T12:00:00Z"), canceledAt: null,
    totalCents: 12700, discountCents: 1300, tipCents: 1000,
    saleItem_sale: [
      { kind: "SERVICE", nameSnapshot: "Serviço histórico", quantity: 1, totalCents: 6750, saleServiceComponent_saleItem: [component] },
      { kind: "PRODUCT", nameSnapshot: "Produto histórico", quantity: 1, totalCents: 4950, saleServiceComponent_saleItem: [] },
    ],
    payment_sale: [{ method: "CASH", status: "RECORDED", appliedCents: 5000, refundedCents: 0 }, { method: "PIX", status: "RECORDED", appliedCents: 7700, refundedCents: 0 }],
  }
}
const summarize = (paid: FinanceSale[], canceled: FinanceSale[] = [], professionalId: string | null = null) => summarizeCheckout(paid, canceled, period.current, period.timezone, professionalId)
function data(paid = [sale()], canceled: FinanceSale[] = []): DashboardSummary {
  const current = summarize(paid, canceled)
  return { period: { start: period.start, end: period.end, timezone: period.timezone, previousStart: period.previousStart, previousEnd: period.previousEnd }, compare: true, professionalId: null, professionals: [], finance: { source: "CHECKOUT", scope: "TENANT", current, previous: summarize([]) }, metrics: { grossCents: current.paidTotalCents, netCents: null, averageTicketCents: current.averageTicketCents, appointments: null, servedCustomers: null, newCustomers: 0, activeCustomers: 0, cancellations: null, occupancy: null, previousNewCustomers: 0 } }
}

describe("Financeiro do Dashboard: fonte oficial Sale", () => {
  it("PAID compõe faturamento, quantidade e ticket sem duplicar pagamentos mistos", () => {
    const current = summarize([sale()])
    expect(current).toMatchObject({ paidTotalCents: 12700, paidSales: 1, averageTicketCents: 12700 })
    expect(current.payments.find(p => p.method === "CASH")).toEqual({ method: "CASH", appliedCents: 5000, sales: 1 })
    expect(current.payments.find(p => p.method === "PIX")).toEqual({ method: "PIX", appliedCents: 7700, sales: 1 })
    expect(current.payments.reduce((sum, p) => sum + p.appliedCents, 0)).toBe(12700)
  })
  it.each(["DRAFT", "PENDING", "VOIDED", "CANCELED"] as const)("%s nunca gera receita ativa", status => {
    expect(summarize([{ ...sale(), status }])).toMatchObject({ paidTotalCents: 0, paidSales: 0, averageTicketCents: 0, postedCommissionsCents: 0, servicesQuantity: 0 })
  })
  it("dinheiro recebido e troco não são fonte de faturamento ou divisão por método", () => {
    const row = sale(); Object.assign(row.payment_sale[0], { cashReceivedCents: 100000, changeCents: 95000 })
    const result = summarize([row]); expect(result.paidTotalCents).toBe(12700)
    expect(result.payments[0].appliedCents).toBe(5000)
  })
  it("separa serviços, produtos, descontos e gorjetas usando snapshots líquidos", () => {
    expect(summarize([sale()])).toMatchObject({ servicesRevenueCents: 6750, productsRevenueCents: 4950, discountsCents: 1300, tipsCents: 1000, servicesQuantity: 1, productsQuantity: 1 })
    const f = summarize([sale()]); expect(f.servicesRevenueCents + f.productsRevenueCents + f.tipsCents).toBe(f.paidTotalCents)
    expect(f.ranking[0]).toMatchObject({ name: "Serviço histórico", revenueCents: 6750 })
  })
  it("conta uma venda e um método uma única vez, mesmo com duas parcelas do mesmo método", () => {
    const row = sale(); row.payment_sale = [{ method: "PIX", status: "RECORDED", appliedCents: 7000, refundedCents: 0 }, { method: "PIX", status: "RECORDED", appliedCents: 5700, refundedCents: 0 }]
    const f = summarize([row, row]); expect(f.paidSales).toBe(1)
    expect(f.payments.find(p => p.method === "PIX")).toEqual({ method: "PIX", appliedCents: 12700, sales: 1 })
  })
  it("pagamentos estornados são excluídos; parciais consideram somente saldo aplicado ativo", () => {
    const row = sale(); row.payment_sale[0] = { ...row.payment_sale[0], status: "REFUNDED", refundedCents: 5000 }
    row.payment_sale[1] = { ...row.payment_sale[1], status: "PARTIALLY_REFUNDED", refundedCents: 700 }
    const f = summarize([row]); expect(f.payments[0].appliedCents).toBe(0); expect(f.payments.find(p => p.method === "PIX")?.appliedCents).toBe(7000)
  })
  it("comissões usam EARNED/POSTED e não a comissão atual ou gorjetas", () => {
    const row = sale(), entries = row.saleItem_sale[0].saleServiceComponent_saleItem[0].commissionEntry_component
    entries.push({ kind: "EARNED", status: "REVERSED", amountCents: 1234 }, { kind: "REVERSAL", status: "POSTED", amountCents: 999 })
    expect(summarize([row])).toMatchObject({ postedCommissionsCents: 2700, commissionReversalsCents: 0 })
    expect(summarize([row]).professionals[0]).toMatchObject({ servicesRevenueCents: 6750, postedCommissionsCents: 2700 })
  })
  it("cancelamento não é receita; usa canceledAt, estornos e reversões existentes, sem duplicar", () => {
    const canceled = sale(); canceled.status = "CANCELED"; canceled.finalizedAt = new Date("2026-09-20T12:00:00Z"); canceled.canceledAt = new Date("2026-10-01T12:00:00Z")
    canceled.payment_sale = canceled.payment_sale.map(p => ({ ...p, status: "REFUNDED", refundedCents: p.appliedCents }))
    canceled.saleItem_sale[0].saleServiceComponent_saleItem[0].commissionEntry_component = [{ kind: "EARNED", status: "REVERSED", amountCents: 2700 }, { kind: "REVERSAL", status: "POSTED", amountCents: 2700 }]
    expect(summarize([canceled], [canceled, canceled])).toMatchObject({ paidTotalCents: 0, paidSales: 0, canceledSales: 1, canceledAmountCents: 12700, refundedPaymentCents: 12700, postedCommissionsCents: 0, commissionReversalsCents: 2700 })
  })
  it("descarte legado não é cancelamento financeiro nem inventa estornos ou comissões", () => {
    const row = sale(); row.status = "CANCELED"; row.finalizedAt = null; row.canceledAt = new Date("2026-10-01T12:00:00Z"); row.payment_sale = []; row.saleItem_sale = []
    expect(summarize([row], [row])).toMatchObject({ paidTotalCents: 0, paidSales: 0, canceledSales: 0, canceledAmountCents: 0, refundedPaymentCents: 0, commissionReversalsCents: 0 })
  })
  it("VOIDED nunca integra faturamento ou cancelamentos, mesmo entre snapshots de outra origem", () => {
    const row = sale(); row.status = "VOIDED"; row.finalizedAt = null; row.canceledAt = new Date("2026-10-01T12:00:00Z")
    expect(summarize([row], [row])).toMatchObject({ paidTotalCents: 0, paidSales: 0, canceledSales: 0, canceledAmountCents: 0, refundedPaymentCents: 0, commissionReversalsCents: 0, discountsCents: 0, tipsCents: 0 })
  })
  it("consulta tenant-safe exige finalização anterior em cancelamentos nos dois períodos", async () => {
    const findMany = vi.fn().mockResolvedValue([]), client = { sale: { findMany } } as unknown as Prisma.TransactionClient
    const result = await checkoutFinance(client, "tenant", period, null)
    expect(result.current.canceledSales).toBe(0); expect(result.previous?.canceledSales).toBe(0)
    expect(findMany).toHaveBeenCalledTimes(4)
    for (const [index, range] of [[1, period.current], [3, period.previous]] as const) expect(findMany.mock.calls[index][0]).toMatchObject({ where: { barbershopId: "tenant", status: "CANCELED", finalizedAt: { not: null }, canceledAt: range } })
    expect(findMany.mock.calls[0][0]).toMatchObject({ where: { barbershopId: "tenant", status: "PAID", finalizedAt: period.current } })
  })
  it("limites são inclusivo/exclusivo em finalizedAt no timezone, não createdAt", () => {
    const start = { ...sale(), id: "start", finalizedAt: period.current.gte }
    const before = { ...sale(), id: "before", finalizedAt: new Date(period.current.gte.getTime() - 1) }
    const last = { ...sale(), id: "last", finalizedAt: new Date(period.current.lt.getTime() - 1) }
    const end = { ...sale(), id: "end", finalizedAt: period.current.lt }
    Object.assign(before, { createdAt: new Date("2026-10-01T15:00:00Z") })
    expect(summarize([start, before, last, end])).toMatchObject({ paidSales: 2, paidTotalCents: 25400 })
    expect(summarize([start, last]).daily).toEqual([{ date: "2026-10-01", paidTotalCents: 25400, sales: 2 }])
    expect(summarize([{ ...sale(), finalizedAt: null }]).paidSales).toBe(0)
  })
  it("cancelamentos fora do intervalo não afetam indicador de cancelamento", () => {
    const row = sale(); row.status = "CANCELED"; row.canceledAt = period.current.lt
    expect(summarize([], [row]).canceledSales).toBe(0)
  })
  it("período anterior usa o mesmo contrato financeiro", () => {
    const row = { ...sale(), finalizedAt: new Date("2026-09-30T12:00:00Z") }
    expect(summarize([row]).paidSales).toBe(0)
    expect(summarizeCheckout([row], [], period.previous, period.timezone, null).paidSales).toBe(1)
  })
  it("combo usa valor de item uma vez e conta todos os componentes históricos", () => {
    const row = sale(), item = row.saleItem_sale[0]
    item.kind = "PACKAGE"; item.quantity = 2; item.saleServiceComponent_saleItem = Array.from({ length: 4 }, () => ({ ...item.saleServiceComponent_saleItem[0] }))
    expect(summarize([row])).toMatchObject({ servicesRevenueCents: 6750, servicesQuantity: 4 })
    expect(summarize([row]).ranking.find(i => i.kind === "PACKAGE")?.quantity).toBe(2)
  })
  it("filtro de participação não inventa rateio de pagamentos e restringe comissões individuais", () => {
    const row = sale(), component = row.saleItem_sale[0].saleServiceComponent_saleItem[0]
    row.saleItem_sale[0].saleServiceComponent_saleItem.push({ ...component, professionalId: "other", commissionEntry_component: [{ kind: "EARNED", status: "POSTED", amountCents: 900 }] })
    const f = summarize([row], [], "pro")
    expect(f.paidTotalCents).toBe(12700); expect(f.productsRevenueCents).toBe(4950); expect(f.postedCommissionsCents).toBe(2700)
    expect(f.professionals.map(p => p.id)).toEqual(["pro"])
  })
})

describe("Dashboard: renderização financeira", () => {
  it("exibe indicadores reais, origem, métodos e comparação sem placeholders financeiros", () => {
    const f = data(), html = renderToStaticMarkup(createElement(DashboardFinance, { data: f }))
    for (const label of ["Vendas pagas", "Receita de produtos", "Descontos concedidos", "Gorjetas", "Comissões geradas", "Reversões de comissão", "Vendas canceladas", "Pagamentos estornados", "Produtos vendidos", "Serviços vendidos", "PIX", "Dinheiro", "Anterior:", "Produto histórico"]) expect(html).toContain(label)
    expect(html).not.toMatch(/NaN|Infinity|Dados insuficientes/)
    const metrics = renderToStaticMarkup(createElement(DashboardMetrics, { data: f }))
    expect(metrics).toContain("Faturamento pago"); expect(metrics).toContain("Agenda"); expect(metrics).toContain("Receita líquida")
  })
  it("zero é real e mantém estado vazio e sem base percentual", () => {
    const html = renderToStaticMarkup(createElement(DashboardFinance, { data: data([]) }))
    expect(html).toContain("Nenhuma venda paga"); expect(html).toContain("0,00"); expect(html).toContain("sem base percentual"); expect(html).not.toContain("NaN")
  })
  it("explica a abrangência das comandas do profissional", () => {
    const f = data(); f.finance.scope = "SALES_WITH_PROFESSIONAL"
    expect(renderToStaticMarkup(createElement(DashboardFinance, { data: f }))).toContain("inclusive de outros profissionais")
  })
})
