import { createElement, type HTMLAttributes } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { CheckoutHistoryController } from "@/features/checkout/history-controller"
import { CheckoutController } from "@/features/checkout/controller"
import { CheckoutHttp } from "@/features/checkout/http"
import { saleHistoryActions } from "@/features/checkout/history-actions"
import { HistoryDetailSheet, HistorySaleActionButtons } from "@/features/checkout/components/history-detail-sheet"
import { SaleHistoryContent, CashHistoryContent } from "@/features/checkout/components/history-detail"
import { CheckoutHistoryPanel } from "@/features/checkout/components/history-panel"
import { presentSale } from "@/lib/checkout/presentation"
import { sale } from "../setup/checkout"
import type { Bootstrap, Sale } from "@/features/checkout/types"
import type { SaleHistoryDetail, CashHistoryDetail } from "@/features/checkout/history-types"

vi.mock("@/components/ui/sheet", () => {
  const div = (props: HTMLAttributes<HTMLDivElement>) => createElement("div", props)
  return { Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? createElement("div", {}, children) : null, SheetContent: div, SheetHeader: div, SheetTitle: div, SheetDescription: div }
})
function bootstrap(role: "BARBERSHOP_OWNER" | "ASSISTANT" | "BARBER" = "BARBERSHOP_OWNER"): Bootstrap {
  return { operator: { id: "operator", name: "Operador", role, professionalId: "pro", permissions: { sell: true, cash: role !== "BARBER", discount: role === "BARBERSHOP_OWNER", cancel: role === "BARBERSHOP_OWNER" } }, services: [], products: [], packages: [], professionals: [], customers: [], cashRegisters: [{ id: "register", name: "Principal" }], openSessions: [{ id: "cash", cashRegisterId: "register", status: "OPEN" }] }
}
function detail(status: Sale["status"] = "PENDING"): SaleHistoryDetail {
  return JSON.parse(JSON.stringify({ ...presentSale(sale({ status, finalizedAt: status === "PAID" || status === "CANCELED" ? new Date() : null })), history: { customerName: null, operatorName: "Operador", canceledByName: null, cashSession: null, stock: [], cash: [], commissions: [], audit: [{ action: "sale.create", createdAt: "2026-10-25T12:00:00Z", actor: "Operador" }], auditHasMore: false, timezone: "America/Sao_Paulo" } })) as SaleHistoryDetail
}
function harness(status: Sale["status"] = "PENDING") {
  const target = detail(status)
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    if (init?.method === "POST") return Response.json({ ...target, status: status === "PAID" ? "CANCELED" : "VOIDED" })
    if (String(url).includes("sales?")) return Response.json({ items: [], pageSize: 20, nextCursor: null, hasMore: false, period: { timezone: "America/Sao_Paulo" } })
    return Response.json(target)
  })
  return { target, fetcher, controller: new CheckoutHistoryController("sales", new CheckoutHttp(fetcher)) }
}
describe("Histórico operacional: ações por estado e papel", () => {
  it.each(["BARBERSHOP_OWNER", "ASSISTANT", "BARBER"] as const)("%s opera PENDING pelos contratos existentes", role => {
    expect(saleHistoryActions(detail(), bootstrap(role).operator.permissions).map(row => row.action)).toEqual(["continue", "edit", "discard"])
  })
  it.each(["BARBERSHOP_OWNER", "ASSISTANT", "BARBER"] as const)("%s só recebe cancelamento PAID quando autorizado", role => {
    const actions = saleHistoryActions(detail("PAID"), bootstrap(role).operator.permissions)
    expect(actions.some(row => row.action === "cancel")).toBe(role === "BARBERSHOP_OWNER")
  })
  it.each(["VOIDED", "CANCELED"] as const)("%s é somente leitura", status => {
    const actions = saleHistoryActions(detail(status), bootstrap().operator.permissions).map(row => row.action)
    expect(actions).toEqual(status === "VOIDED" ? ["details"] : ["details", "reversals"])
  })
  it("descarte legado não oferece reversão financeira", () => {
    expect(saleHistoryActions({ ...detail("CANCELED"), closureKind: "LEGACY_VOIDED", finalizedAt: null }, bootstrap().operator.permissions)).toEqual([{ action: "details", label: "Ver detalhes do descarte" }])
  })
  it.each(["PENDING", "PAID", "CANCELED", "VOIDED"] as const)("ações %s nunca incluem exclusão, correção de pagamento ou comprovante fictício", status => {
    const html = renderToStaticMarkup(createElement(HistorySaleActionButtons, { sale: detail(status), data: bootstrap(), disabled: false, onAction: vi.fn() }))
    expect(html).not.toMatch(/Remover venda|Corrigir pagamento|comprovante|Imprimir|WhatsApp/)
  })
  it("descarte exige motivo e usa endpoint void/version/idempotência", async () => {
    const { controller, fetcher } = harness(); await controller.openAction("sale", "discard")
    await controller.confirmAction(""); expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0)
    const result = await controller.confirmAction("Cliente desistiu")
    expect(result?.status).toBe("VOIDED")
    const post = fetcher.mock.calls.find(call => call[1]?.method === "POST")!
    expect(post[0]).toBe("/api/checkout/sales/sale/void"); expect(JSON.parse(String(post[1]?.body))).toEqual({ reason: "Cliente desistiu", expectedVersion: 0 })
    expect(post[1]?.headers).toHaveProperty("Idempotency-Key")
  })
  it("cancelamento usa endpoint existente com caixa e motivo, sem editar pagamentos", async () => {
    const { controller, fetcher } = harness("PAID"); await controller.openAction("sale", "cancel"); await controller.confirmAction("Lançamento incorreto", "cash")
    const post = fetcher.mock.calls.find(call => call[1]?.method === "POST")!
    expect(post[0]).toBe("/api/checkout/sales/sale/cancel")
    expect(JSON.parse(String(post[1]?.body))).toEqual({ reason: "Lançamento incorreto", cashSessionId: "cash" })
    expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
  })
  it.each(["PAID", "VOIDED", "CANCELED"] as const)("versão atual %s impede abrir descarte", async status => {
    const { controller, fetcher } = harness(status); await controller.openAction("sale", "discard"); await controller.confirmAction("Motivo")
    expect(controller.getSnapshot().action).toBeNull(); expect(fetcher.mock.calls.every(call => call[1]?.method === "GET")).toBe(true)
  })
  it("resposta incerta bloqueia mudanças e repete exatamente a mesma intenção", async () => {
    const { controller, fetcher } = harness(); await controller.openAction("sale", "discard")
    fetcher.mockRejectedValueOnce(new TypeError("network")); await controller.confirmAction("Motivo")
    expect(controller.getSnapshot().actionRetry).toBe(true)
    controller.closeAction(); controller.closeDetail(); await controller.openAction("other", "cancel")
    expect(controller.getSnapshot().detailOpen).toBe(true)
    await controller.confirmAction("Motivo alterado"); await controller.retryAction()
    const posts = fetcher.mock.calls.filter(call => call[1]?.method === "POST")
    expect(posts).toHaveLength(2); expect(posts[0][1]?.body).toEqual(posts[1][1]?.body); expect(posts[0][1]?.headers).toEqual(posts[1][1]?.headers)
  })
  it("falha de leitura após confirmação não torna o cancelamento incerto", async () => {
    const { controller, fetcher } = harness("PAID"); await controller.openAction("sale", "cancel")
    fetcher.mockResolvedValueOnce(Response.json(detail("CANCELED"))).mockRejectedValue(new Error("read failed"))
    await controller.confirmAction("Motivo"); expect(controller.getSnapshot().actionRetry).toBe(false); expect(controller.getSnapshot().action).toBeNull()
    await controller.retryAction(); expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
  })
  it("duplo clique dispara somente um POST", async () => {
    const { controller, fetcher } = harness(); await controller.openAction("sale", "discard")
    await Promise.all([controller.confirmAction("Motivo"), controller.confirmAction("Motivo")])
    expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
  })
  it("continuar e editar usam GET e preservam pagamentos da mesma PENDING", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(detail()))
    const controller = new CheckoutController(new CheckoutHttp(fetcher), bootstrap())
    expect(await controller.openFromHistory("sale")).toBe(true); controller.addPayment(); const payments = controller.getSnapshot().payments
    expect(await controller.openFromHistory("sale", true)).toBe(true); expect(controller.getSnapshot().editing).toBe(true)
    expect(controller.getSnapshot().payments).toEqual(payments); expect(fetcher.mock.calls.every(call => call[1]?.method === "GET")).toBe(true)
  })
  it("não sobrescreve outra PENDING nem rascunho local ao continuar", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(detail()))
    const controller = new CheckoutController(new CheckoutHttp(fetcher), bootstrap())
    await controller.openFromHistory("sale"); expect(await controller.openFromHistory("other")).toBe(false); expect(fetcher).toHaveBeenCalledTimes(1)
    const data = bootstrap(); data.services = [{ id: "service", name: "Corte", priceCents: 1000, durationMinutes: 30, category: null }]; data.professionals = [{ id: "pro", name: "Profissional", serviceIds: ["service"] }]
    const draft = new CheckoutController(new CheckoutHttp(fetcher), data); draft.add("SERVICE", "service")
    expect(await draft.openFromHistory("sale")).toBe(false); expect(draft.getSnapshot().lines).toHaveLength(1); expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it("mudar contexto reinicia cursor e preserva filtro de cliente/período", async () => {
    const { controller, fetcher } = harness(); controller.setFilters({ customerQuery: "Maria", period: "today" }); await controller.setView("open")
    expect(String(fetcher.mock.calls.at(-1)![0])).toContain("view=open"); expect(String(fetcher.mock.calls.at(-1)![0])).toContain("customerQuery=Maria")
    controller.setFilters({ includeVoided: true }); await controller.setView("history")
    expect(controller.getSnapshot().filters).toMatchObject({ view: "history", includeVoided: false, status: "", customerQuery: "Maria", period: "today" })
  })
  it("padrão mostra contexto principal, filtro de descarte e nenhuma ação falsa", async () => {
    const { controller } = harness(); await controller.load()
    const html = renderToStaticMarkup(createElement(CheckoutHistoryPanel, { kind: "sales", provided: controller, data: bootstrap() }))
    expect(html).toContain("Comandas abertas"); expect(html).toContain("Histórico principal"); expect(html).toContain("Incluir descartadas")
    expect(html).not.toContain('<option value="VOIDED">'); expect(html).not.toMatch(/Remover venda|Corrigir pagamento/)
  })
  it("painel lateral mantém cabeçalho/ações fixos, rolagem interna e largura mobile", async () => {
    const { controller } = harness(); await controller.openDetail("sale")
    const html = renderToStaticMarkup(createElement(HistoryDetailSheet, { state: controller.getSnapshot(), controller, data: bootstrap(), onAction: vi.fn() }))
    for (const value of ["history-detail-sheet", "h-[100dvh]", "w-full", "sm:max-w-xl", "overflow-hidden", "history-detail-scroll", "overflow-y-auto", "min-h-0", "shrink-0", "Ações do detalhe histórico"]) expect(html).toContain(value)
    expect(html.indexOf("Ações do detalhe histórico")).toBeGreaterThan(html.indexOf("history-detail-scroll"))
  })
  it.each([false, true])("seções recolhíveis e conteúdo sensível somente quando autorizado: %s", owner => {
    const data = detail(); if (!owner) { data.history.commissions = null; data.history.audit = [] }
    const html = renderToStaticMarkup(createElement(SaleHistoryContent, { data }))
    for (const label of ["Resumo", "Itens e profissionais", "Pagamentos", "Estoque", "Cancelamento e reversões"]) expect(html).toContain(`>${label}</summary>`)
    expect(html.includes("Auditoria da venda")).toBe(owner); expect(html.includes("Comissões históricas")).toBe(owner)
    expect(html).not.toContain("<Dialog")
  })
  it("conferência renderiza números oficiais sem recalcular dinheiro ou misturar PIX", () => {
    const data = { session: { id: "cash", cashRegisterName: "Caixa", status: "OPEN", openedBy: "Operador", closedBy: null, shift: "Manhã", openedAt: "2026-10-25T12:00:00Z", closedAt: null, openingBalanceCents: 0, expectedBalanceCents: null, countedBalanceCents: null, differenceCents: null }, notes: null, ledgerBalanceCents: 500, totals: [], movements: { items: [], pageSize: 20, nextCursor: null, hasMore: false }, timezone: "America/Sao_Paulo", cashReceivedCents: 1000, cashChangeCents: 200, cashOriginalEffectCents: 800, finalizedSalesTotalCents: 5000, currentlyPaidSalesTotalCents: 3000, canceledSalesTotalCents: 2000, paymentTotals: [{ method: "PIX", appliedCents: 4200, refundedCents: 2000, netAppliedCents: 2200 }] } satisfies CashHistoryDetail
    const html = renderToStaticMarkup(createElement(CashHistoryContent, { data, page: 1, loading: false, onNext: vi.fn(), onPrevious: vi.fn() }))
    for (const label of ["Saldo físico pelos movimentos", "Troco originalmente entregue", "Efeito líquido original em dinheiro", "PIX", "não é o saldo físico", "Total histórico finalizado", "Total atualmente pago", "Total cancelado após finalização"]) expect(html).toContain(label)
    const source = readFileSync("src/features/checkout/components/history-cash-detail.tsx", "utf8")
    expect(source).not.toMatch(/cashReceivedCents\s*-|reduce\(/)
  })
})
