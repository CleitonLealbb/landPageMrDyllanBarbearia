import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CheckoutHttp } from "@/features/checkout/http"
import { CheckoutHistoryController } from "@/features/checkout/history-controller"
import { CheckoutHistoryPanel } from "@/features/checkout/components/history-panel"
import { CashHistoryContent, SaleHistoryContent } from "@/features/checkout/components/history-detail"
import { CheckoutScreen } from "@/features/checkout/components/checkout-screen"
import { CheckoutController } from "@/features/checkout/controller"
import type { Bootstrap } from "@/features/checkout/types"
import type { CashHistoryDetail, CashHistoryRow, HistoryPage, SaleHistoryDetail, SaleHistoryRow } from "@/features/checkout/history-types"
import { presentSale } from "@/lib/checkout/presentation"
import { sale } from "../setup/checkout"
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => createElement("button", { "aria-label": "Abrir navegação" }, "Menu") }))

function bootstrap(): Bootstrap {
  return { operator: { id: "operator", name: "Operador", role: "BARBERSHOP_OWNER", professionalId: null, permissions: { sell: true, cash: true, discount: true, cancel: true } }, services: [], products: [], packages: [], professionals: [], customers: [], openSessions: [], cashRegisters: [] }
}
const date = "2026-10-22T12:00:00.000Z"
function salesPage(nextCursor: string | null = null): HistoryPage<SaleHistoryRow> {
  return { items: [{ id: "technical-sale-id", status: "PAID", closureKind: null, totalCents: 1000, itemCount: 1, customer: { id: "customer", name: "Cliente histórico" }, professionals: [{ id: "pro", name: "Profissional antigo" }], createdAt: date, finalizedAt: date, canceledAt: null, voidedAt: null, cashRegisterName: "Caixa antigo" }], pageSize: 20, nextCursor, hasMore: nextCursor !== null, period: { start: "2026-10-01", end: "2026-10-31", timezone: "America/Sao_Paulo", dateField: "createdAt" } }
}
function cashDetail(): CashHistoryDetail {
  return { session: { id: "cash-id", cashRegisterName: "CHECKOUT_VISUAL_TEST_1234567890abcdef12345678 Caixa visual", status: "CLOSED", shift: "Manhã", openedAt: date, closedAt: date, openedBy: "Operador", closedBy: "Responsável", openingBalanceCents: 5000, expectedBalanceCents: 5000, countedBalanceCents: 4900, differenceCents: -100 }, notes: null, ledgerBalanceCents: 5000, totals: [{ kind: "OPENING", amountCents: 5000 }], movements: { items: [], pageSize: 20, nextCursor: null, hasMore: false }, timezone: "America/Sao_Paulo" }
}
function saleDetail(): SaleHistoryDetail {
  return JSON.parse(JSON.stringify({ ...presentSale(sale()), history: { customerName: "Cliente histórico", operatorName: "Operador", canceledByName: "Responsável", cashSession: null, stock: [], cash: [], commissions: [], audit: [], auditHasMore: false, timezone: "America/Sao_Paulo" } })) as SaleHistoryDetail
}
function setup(kind: "sales" | "cash-sessions" = "sales") {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(salesPage()))
  return { fetcher, controller: new CheckoutHistoryController(kind, new CheckoutHttp(fetcher)) }
}

describe("Históricos: controlador somente GET", () => {
  it("carrega sem tenant, ator, papel ou chave de escrita", async () => {
    const { fetcher, controller } = setup(); await controller.load()
    expect(fetcher.mock.calls[0][0]).toBe("/api/checkout/sales?period=month&pageSize=20&dateField=createdAt")
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "GET", cache: "no-store", credentials: "same-origin" })
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty("body")
    expect(fetcher.mock.calls[0][1]?.headers).toBeUndefined()
  })
  it("paginação reutiliza filtros aplicados e reinicia ao aplicar outros filtros", async () => {
    const { fetcher, controller } = setup()
    fetcher.mockResolvedValueOnce(Response.json(salesPage("opaque-cursor")))
    await controller.load(); controller.setFilters({ status: "CANCELED" })
    await controller.next()
    expect(fetcher.mock.calls[1][0]).toContain("cursor=opaque-cursor")
    expect(fetcher.mock.calls[1][0]).not.toContain("status=CANCELED")
    expect(controller.getSnapshot().page).toBe(2)
    await controller.previous(); expect(controller.getSnapshot().page).toBe(1)
    controller.setFilters({ period: "custom", start: "2026-10-01", end: "2026-10-02", customerQuery: " Maria ", professionalQuery: "Antigo" })
    await controller.apply()
    const last = String(fetcher.mock.calls.at(-1)![0])
    expect(last).toContain("status=CANCELED"); expect(last).toContain("customerQuery=Maria"); expect(last).toContain("start=2026-10-01")
    expect(last).not.toContain("cursor=")
  })
  it("respostas antigas não substituem resultado de uma busca mais recente", async () => {
    const { fetcher, controller } = setup(); let resolve!: (value: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const first = controller.load(); await controller.apply()
    const current = controller.getSnapshot().sales
    resolve(Response.json({ ...salesPage(), items: [] })); await first
    expect(controller.getSnapshot().sales).toBe(current)
  })
  it.each([401, 403, 409, 500, 503])("traduz HTTP %i sem expor detalhe retornado pelo servidor", async status => {
    const { fetcher, controller } = setup(); fetcher.mockResolvedValueOnce(Response.json({ message: "SECRET SQL stack" }, { status }))
    await controller.load()
    expect(controller.getSnapshot().status).toBe(status)
    expect(controller.getSnapshot().error).toBeTruthy()
    expect(controller.getSnapshot().error).not.toContain("SECRET")
    expect(controller.getSnapshot().loading).toBe(false)
  })
  it("detalhe complementar usa GET e fechar ignora resposta atrasada", async () => {
    const { fetcher, controller } = setup(); let resolve!: (value: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const work = controller.openDetail("sale/id")
    expect(fetcher.mock.calls[0][0]).toBe("/api/checkout/sales/sale%2Fid?include=history")
    controller.closeDetail(); resolve(Response.json(saleDetail())); await work
    expect(controller.getSnapshot().saleDetail).toBeNull()
    expect(controller.getSnapshot().detailOpen).toBe(false)
  })
  it("caixa pagina movimentos e permite consultar venda vinculada e voltar", async () => {
    const { fetcher, controller } = setup("cash-sessions")
    fetcher.mockResolvedValueOnce(Response.json({ ...cashDetail(), movements: { ...cashDetail().movements, hasMore: true, nextCursor: "moves-next" } }))
    await controller.openDetail("cash-id")
    fetcher.mockResolvedValueOnce(Response.json(cashDetail())); await controller.nextMovements()
    expect(fetcher.mock.calls[1][0]).toContain("cursor=moves-next")
    expect(controller.getSnapshot().movementPage).toBe(2)
    fetcher.mockResolvedValueOnce(Response.json(saleDetail())); await controller.openLinkedSale("sale-id")
    expect(fetcher.mock.calls[2][0]).toBe("/api/checkout/sales/sale-id?include=history")
    expect(controller.getSnapshot().detailKind).toBe("sales")
    fetcher.mockResolvedValueOnce(Response.json(cashDetail())); await controller.backToCash()
    expect(controller.getSnapshot().detailKind).toBe("cash-sessions")
    expect(controller.getSnapshot().cashDetail?.session.status).toBe("CLOSED")
    expect(fetcher.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true)
  })
})

describe("Históricos: componentes e permissões visuais", () => {
  it("loading, filtros rotulados e paginação têm estados explícitos", () => {
    const { controller } = setup()
    controller.setFilters({ period: "custom" })
    const html = renderToStaticMarkup(createElement(CheckoutHistoryPanel, { kind: "sales", data: bootstrap(), provided: controller }))
    for (const text of ["Carregando histórico", "Data inicial", "Data final", "Buscar cliente por nome", "Buscar profissional no histórico", "Data de referência", "Estado", "Próxima página"]) expect(html).toContain(text)
    expect(html).toContain('aria-label="Filtros do histórico"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('disabled=""')
  })
  it("lista clientes/profissionais históricos sem expor o ID como texto", async () => {
    const { controller } = setup(); await controller.load()
    const html = renderToStaticMarkup(createElement(CheckoutHistoryPanel, { kind: "sales", data: bootstrap(), provided: controller }))
    expect(html).toContain("Cliente histórico"); expect(html).toContain("Profissional antigo")
    expect(html).toContain("10,00")
    expect(html.replace(/<[^>]*>/g, "")).not.toContain("technical-sale-id")
    expect(html).not.toContain("Cancelar venda</button>")
    expect(html).not.toContain("Editar venda</button>")
  })
  it("catálogo vazio de resultados e erro recuperável não são dados fictícios", async () => {
    const { fetcher, controller } = setup(); fetcher.mockResolvedValueOnce(Response.json({ ...salesPage(), items: [] }))
    await controller.load()
    expect(renderToStaticMarkup(createElement(CheckoutHistoryPanel, { kind: "sales", data: bootstrap(), provided: controller }))).toContain("Nenhum registro encontrado")
    fetcher.mockResolvedValueOnce(Response.json({}, { status: 500 })); await controller.load()
    const html = renderToStaticMarkup(createElement(CheckoutHistoryPanel, { kind: "sales", data: bootstrap(), provided: controller }))
    expect(html).toContain('role="alert"'); expect(html).toContain("Tentar novamente")
  })
  it.each(["BARBERSHOP_OWNER", "ASSISTANT", "BARBER"] as const)("navegação respeita %s sem reiniciar o carrinho", role => {
    const data = bootstrap(); data.operator.role = role; data.operator.permissions.cash = role !== "BARBER"
    const controller = new CheckoutController(new CheckoutHttp(vi.fn()), data), before = controller.getSnapshot()
    const html = renderToStaticMarkup(createElement(CheckoutScreen, { controller }))
    expect(html).toContain("Histórico de vendas")
    if (role === "BARBER") expect(html).not.toContain("Histórico de caixas")
    else expect(html).toContain("Histórico de caixas")
    expect(controller.getSnapshot()).toBe(before)
  })
  it("destino físico não é inferido de uma reversão legada e valores originais continuam visíveis", () => {
    const data = saleDetail(); data.status = "CANCELED"; data.closureKind = "CANCELED"; data.finalizedAt = date; data.cancellationReason = "Lançamento incorreto"; data.canceledAt = date
    data.items[0].kind = "PRODUCT"; data.history.stock = [{ id: "stock", itemId: data.items[0].id, kind: "REVERSAL", quantityDelta: 1, reason: "Cancelamento", createdAt: date, reversalOfId: "original", actor: "Operador" }]
    const html = renderToStaticMarkup(createElement(SaleHistoryContent, { data }))
    for (const text of ["Venda cancelada", "Total original da venda", "Lançamento incorreto", "destino físico", "não é possível afirmar devolução física", "Repasse externo", "Registros manuais"]) expect(html).toContain(text)
    expect(html).not.toContain("Cancelar venda</button>")
  })
  it.each([false, true])("descarte legado=%s preserva itens e totais sem mensagem de reversão", legacy => {
    const data = saleDetail()
    Object.assign(data, { status: legacy ? "CANCELED" : "VOIDED", closureKind: legacy ? "LEGACY_VOIDED" : "VOIDED", finalizedAt: null, canceledAt: legacy ? date : null, cancellationReason: legacy ? "Duplicidade legada" : null,
      voidedAt: legacy ? null : date, voidReason: legacy ? null : "Duplicidade", voidedByName: legacy ? null : "Operador do descarte" })
    data.history.audit = [{ action: legacy ? "sale.cancel" : "sale.void", createdAt: date, actor: "Operador do descarte" }]
    const html = renderToStaticMarkup(createElement(SaleHistoryContent, { data }))
    expect(html).toContain("Comanda descartada. Nenhuma movimentação financeira foi realizada.")
    expect(html).toContain(legacy ? "Descartada (legado)" : "Descartada")
    expect(html).toContain(legacy ? "Duplicidade legada" : "Duplicidade")
    expect(html).toContain("Total original da venda"); expect(html).toContain(data.items[0].nameSnapshot)
    expect(html).not.toContain('aria-label="Cancelamento"')
    expect(html).not.toContain("Venda cancelada")
    expect(html).not.toContain("lançamentos aplicáveis foram revertidos")
    expect(html).not.toContain("Cancelar venda</button>")
    if (!legacy) expect(html).toContain("Descarte ·")
  })
  it("lista distingue descartada de cancelada e oferece filtro e data de descarte", async () => {
    const { fetcher, controller } = setup(), page = salesPage()
    page.items = [
      { ...page.items[0], id: "voided", status: "VOIDED", closureKind: "VOIDED", finalizedAt: null, voidedAt: date },
      { ...page.items[0], id: "legacy", status: "CANCELED", closureKind: "LEGACY_VOIDED", finalizedAt: null, canceledAt: date },
      { ...page.items[0], id: "canceled", status: "CANCELED", closureKind: "CANCELED", canceledAt: date },
    ]
    fetcher.mockResolvedValueOnce(Response.json(page)); await controller.load()
    const html = renderToStaticMarkup(createElement(CheckoutHistoryPanel, { kind: "sales", data: bootstrap(), provided: controller }))
    expect(html).toContain('<option value="VOIDED">Descartada</option>')
    expect(html).toContain('<option value="voidedAt">Descarte (inclui legado)</option>')
    expect(html).toContain("Descartada (legado)")
    expect(html).toContain("Cancelada")
    controller.setFilters({ status: "VOIDED", dateField: "voidedAt" }); await controller.apply()
    expect(fetcher.mock.calls.at(-1)![0]).toContain("status=VOIDED")
    expect(fetcher.mock.calls.at(-1)![0]).toContain("dateField=voidedAt")
  })
  it("caixa fechado mostra diferença original e totais inteiros, sem oferecer reabertura", () => {
    const html = renderToStaticMarkup(createElement(CashHistoryContent, { data: cashDetail(), page: 1, loading: false, onNext: vi.fn(), onPrevious: vi.fn() }))
    for (const text of ["Caixa visual", "Fechado", "Saldo esperado no fechamento original", "Saldo contado original", "Diferença original", "Totais da sessão inteira", "PIX e cartões não são entradas físicas"]) expect(html).toContain(text)
    expect(html).not.toContain("CHECKOUT_VISUAL_TEST")
    expect(html).not.toContain("Reabrir caixa</button>")
    expect(html).not.toContain("Registrar ajuste</button>")
  })
  it("divergência é apresentada, nunca corrigida automaticamente", () => {
    const data = cashDetail(); data.ledgerBalanceCents = 5500
    const html = renderToStaticMarkup(createElement(CashHistoryContent, { data, page: 1, loading: false, onNext: vi.fn(), onPrevious: vi.fn() }))
    expect(html).toContain('role="alert"'); expect(html).toContain("Nenhuma correção automática")
    expect(data.session.expectedBalanceCents).toBe(5000)
  })
  it("histórico de caixas oferece os mesmos filtros sem acessar escrita", async () => {
    const { fetcher, controller } = setup("cash-sessions")
    const page: HistoryPage<CashHistoryRow> = { ...salesPage(), items: [cashDetail().session] }
    fetcher.mockResolvedValueOnce(Response.json(page)); await controller.load()
    const html = renderToStaticMarkup(createElement(CheckoutHistoryPanel, { kind: "cash-sessions", data: bootstrap(), provided: controller }))
    expect(html).toContain("Consultar conferência"); expect(html).toContain("Somente consulta")
    expect(fetcher.mock.calls[0][0]).toContain("cash-sessions?")
  })
})
