import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DashboardError, DashboardLoading, InsufficientData } from "@/features/dashboard/components/dashboard-states"
import { DashboardMetrics } from "@/features/dashboard/components/dashboard-metrics"
import type { DashboardSummary } from "@/features/dashboard/types"
describe("Estados do dashboard", () => {
  it("renderiza carregamento acessível", () => {
    expect(renderToStaticMarkup(createElement(DashboardLoading))).toContain('aria-label="Carregando dashboard"')
  })
  it("renderiza erro com ação de tentar novamente", () => {
    const html = renderToStaticMarkup(createElement(DashboardError, { message: "Falha ao carregar", retry: () => {} }))
    expect(html).toContain('role="alert"')
    expect(html).toContain("Tentar novamente")
  })
  it("explica dados insuficientes", () => {
    expect(renderToStaticMarkup(createElement(InsufficientData, { reason: "Faltam pagamentos" }))).toContain("Faltam pagamentos")
  })
  it("distingue zero real de dados ausentes e compara com base zero", () => {
    const data = { compare: true, professionalId: null, metrics: { newCustomers: 0, previousNewCustomers: 0, grossCents: 0, netCents: null, appointments: null, averageTicketCents: 0, servedCustomers: null, cancellations: null, occupancy: null } } as DashboardSummary
    const html = renderToStaticMarkup(createElement(DashboardMetrics, { data }))
    expect(html).toContain("Dados insuficientes")
    expect(html).toContain("sem base percentual")
    expect(html).not.toContain("NaN")
  })
})
