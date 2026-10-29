import { describe, expect, it, vi } from "vitest"
import { Children, createElement, isValidElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CheckoutController } from "@/features/checkout/controller"
import { CheckoutHttp } from "@/features/checkout/http"
import { amount, estimate, paymentInput } from "@/features/checkout/helpers"
import { Catalog } from "@/features/checkout/components/catalog"
import { ClearConfirmation, DiscardConfirmation, Receipt } from "@/features/checkout/components/receipt"
import { CashPanel } from "@/features/checkout/components/cash-panel"
import { CheckoutScreen } from "@/features/checkout/components/checkout-screen"
import { displayName } from "@/features/checkout/display"
import { MobileReceiptContent, ReceiptPanel } from "@/features/checkout/components/receipt-panel"
import { Payments } from "@/features/checkout/components/payments"
import { Sheet } from "@/components/ui/sheet"
import { Dialog } from "@/components/ui/dialog"
import type { Bootstrap, PaymentDraft, Role, Sale } from "@/features/checkout/types"
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => createElement("button", { "aria-label": "Abrir navegação" }, "Menu") }))

function fixture(role: Role = "BARBERSHOP_OWNER"): Bootstrap {
  const service = { id: "cut", name: "Corte", priceCents: 4500, durationMinutes: 30, category: null }
  const beard = { ...service, id: "beard", name: "Barba", priceCents: 3000 }
  return { operator: { id: "actor", name: "Operador", role, professionalId: "pro", permissions: { sell: true, cash: role !== "BARBER", discount: role === "BARBERSHOP_OWNER", cancel: role === "BARBERSHOP_OWNER" } }, services: [service, beard], packages: [{ id: "combo", name: "Combo", priceCents: 7000, durationMinutes: 60, services: [service, beard] }], professionals: [{ id: "pro", name: "Profissional", serviceIds: ["cut", "beard"] }], products: [{ id: "pomade", name: "Pomada", priceCents: 5500, availableQuantity: 1 }], cashRegisters: [{ id: "register", name: "Recepção" }], openSessions: [{ id: "cash", cashRegisterId: "register", status: "OPEN" }], customers: [] }
}
function sale(status: Sale["status"] = "PENDING"): Sale {
  return { id: "sale", status, version: 1, customerId: null, servicesSubtotalCents: 4500, productsSubtotalCents: 0, discountCents: 0, tipCents: 0, totalCents: 4500, createdAt: "2026-10-22T12:00:00Z", finalizedAt: status === "PAID" || status === "CANCELED" ? "2026-10-22T12:10:00Z" : null, canceledAt: status === "CANCELED" ? "2026-10-22T12:15:00Z" : null, items: [{ id: "item", kind: "SERVICE", nameSnapshot: "Corte histórico", quantity: 1, totalCents: 4500, durationMinutesSnapshot: 30, components: [{ professionalNameSnapshot: "Profissional", serviceNameSnapshot: "Corte" }] }], tips: [], payments: [] }
}
function setup(data = fixture()) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => Response.json(init?.method === "POST" ? sale() : data))
  const http = new CheckoutHttp(fetcher), controller = new CheckoutController(http, data)
  return { controller, fetcher, http }
}
const cashPayment = (amount = "45", received = "50"): PaymentDraft => ({ id: "payment", method: "CASH", amount, received, confirmed: true })

function action(node: ReactNode, label: string): (() => void) | undefined {
  if (!isValidElement<{ children?: ReactNode; "aria-label"?: string; onClick?: () => void }>(node)) return
  if (node.props["aria-label"] === label) return node.props.onClick
  return Children.toArray(node.props.children).map(child => action(child, label)).find(Boolean)
}

describe("Checkout: referência compacta e comanda mobile", () => {
  it("exibe busca, filtros, contagens e seções separados a partir do catálogo real", () => {
    const { controller } = setup()
    const html = renderToStaticMarkup(createElement(Catalog, { state: controller.getSnapshot(), controller }))
    for (const label of ['placeholder="Buscar serviços, combos ou produtos"', "Todos", "Serviços de barbearia", "Combos e pacotes", "Produtos", "4 resultados", "xl:grid-cols-2", "xl:grid-cols-3"]) expect(html).toContain(label)
  })
  it.each(["BARBERSHOP_OWNER", "ASSISTANT", "BARBER"] as const)("caixa fechado respeita os controles autorizados de %s", role => {
    const data = fixture(role); data.openSessions = []
    const { controller } = setup(data)
    const html = renderToStaticMarkup(createElement(CashPanel, { state: controller.getSnapshot(), controller }))
    expect(html).toContain("Caixa fechado")
    expect(html).toContain("Recepção")
    if (role === "BARBER") {
      expect(html).not.toContain("Saldo inicial (R$)")
      expect(html).not.toContain("Abrir caixa")
    } else {
      expect(html).toContain("Saldo inicial (R$)")
      expect(html).toContain("Abrir caixa")
    }
  })
  it("mostra a abertura mesmo quando o DTO não informa o nome do operador da sessão", () => {
    const data = fixture(); data.openSessions[0].openedAt = "2026-10-22T12:00:00Z"
    const { controller } = setup(data)
    expect(renderToStaticMarkup(createElement(CashPanel, { state: controller.getSnapshot(), controller }))).toContain("Abertura:")
  })
  it.each(["PAID", "CANCELED"] as const)("expõe o estado %s com resumo oficial no rodapé", status => {
    const { controller } = setup()
    const state = { ...controller.getSnapshot(), sale: { ...sale(status), totalCents: 9900 } }
    const html = renderToStaticMarkup(createElement(Receipt, { state, controller }))
    expect(html).toContain(status === "PAID" ? "Venda finalizada" : "Venda cancelada")
    const footer = html.slice(html.indexOf("<footer"))
    expect(footer).toContain("Total confirmado")
    expect(footer).toContain("99,00")
    expect(footer).toContain("Nova venda")
    expect(footer).not.toContain("Finalizar venda")
  })
  it("ação de finalizar mostra somente o total confirmado pelo backend", () => {
    const { controller } = setup(); controller.add("SERVICE", "cut")
    const state = { ...controller.getSnapshot(), sale: { ...sale(), totalCents: 9900 } }
    const html = renderToStaticMarkup(createElement(Receipt, { state, controller }))
    expect(html).toContain("Finalizar venda — R$")
    expect(html.slice(html.indexOf("<footer"))).toContain("99,00")
    expect(html.slice(html.indexOf("Finalizar venda"), html.indexOf("</button>", html.indexOf("Finalizar venda")))).not.toContain("45,00")
  })
  it("painel mobile oferece voltar, feedback e rodapé, preservando carrinho e controlador", () => {
    const { controller } = setup(); controller.add("PRODUCT", "pomade")
    const state = { ...controller.getSnapshot(), error: "Estoque insuficiente. Atualize o catálogo.", retry: true }
    const before = controller.getSnapshot()
    const html = renderToStaticMarkup(createElement(Sheet, { open: true }, createElement(MobileReceiptContent, { state, controller })))
    for (const label of ["Voltar ao catálogo", 'role="alert"', "Estoque insuficiente", "Repetir operação com segurança", "h-full max-h-full", "overflow-y-auto", "sticky bottom-0", "Pomada"]) expect(html).toContain(label)
    expect(html.match(/aria-label="Comanda de caixa"/g)).toHaveLength(1)
    expect(controller.getSnapshot()).toBe(before)
  })
  it("gatilho mobile abre diálogo e usa quantidade e total oficiais da venda", () => {
    const { controller } = setup()
    const state = { ...controller.getSnapshot(), sale: sale() }
    const html = renderToStaticMarkup(createElement(ReceiptPanel, { state, controller, itemCount: 1, total: "R$ 45,00" }))
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain("total confirmado R$ 45,00")
    expect(html.match(/aria-label="Comanda de caixa"/g)).toHaveLength(1)
  })
  it("atalho Misto cria duas linhas reais sem confirmar recebimentos nem duplicá-las ao repetir", async () => {
    const { controller } = setup(); controller.add("SERVICE", "cut"); await controller.create()
    const click = () => action(Payments({ state: controller.getSnapshot(), controller }), "Adicionar pagamento misto")?.()
    click()
    const payments = controller.getSnapshot().payments
    expect(payments).toHaveLength(2)
    expect(payments.map(payment => payment.method)).toContain("CASH")
    expect(payments.every(payment => !payment.confirmed)).toBe(true)
    click()
    expect(controller.getSnapshot().payments).toEqual(payments)
  })
  it("Misto preserva dinheiro informado e acrescenta outro método, inclusive em clique repetido", async () => {
    const { controller } = setup(); controller.add("SERVICE", "cut"); await controller.create()
    controller.addPayment()
    const id = controller.getSnapshot().payments[0].id
    controller.payment(id, { method: "CASH", amount: "45", received: "50", confirmed: true })
    const click = action(Payments({ state: controller.getSnapshot(), controller }), "Adicionar pagamento misto")
    click?.(); click?.()
    expect(controller.getSnapshot().payments).toHaveLength(2)
    expect(controller.getSnapshot().payments[0]).toMatchObject({ id, method: "CASH", amount: "45", received: "50", confirmed: true })
    expect(controller.getSnapshot().payments[1]).toMatchObject({ method: "PIX", confirmed: false })
  })
})

describe("Checkout: acabamento visual sem alterar os contratos", () => {
  it("preserva nomes reais e remove prefixos técnicos somente da apresentação", () => {
    expect(displayName("Recepção principal", "Caixa")).toBe("Recepção principal")
    expect(displayName("CHECKOUT_VISUAL_TEST_1234567890abcdef12345678 Caixa visual", "Caixa")).toBe("Caixa visual")
    expect(displayName("CHECKOUT_VISUAL_TEST_1234567890abcdef12345678_cash", "Caixa 2")).toBe("Caixa 2")
    expect(displayName("28173a71-be59-4a14-922a-f62c39c2549d", "Caixa")).toBe("Caixa")
  })
  it("exibe caixa amigável mantendo seu ID técnico exclusivamente no valor da opção", () => {
    const data = fixture(), id = "CHECKOUT_VISUAL_TEST_1234567890abcdef12345678_cash"
    data.cashRegisters = [{ id, name: "CHECKOUT_VISUAL_TEST_1234567890abcdef12345678 Caixa visual" }, { id: "opaque-id", name: "opaque-id" }]
    const { controller } = setup(data)
    const html = renderToStaticMarkup(createElement(CashPanel, { state: controller.getSnapshot(), controller }))
    expect(html).toContain(`value="${id}"`)
    expect(html).toContain("Caixa visual</option>")
    expect(html).toContain("Caixa 2</option>")
    expect(html.replace(/<[^>]*>/g, "")).not.toMatch(/CHECKOUT_VISUAL_TEST|opaque-id/)
    expect(data.cashRegisters[0].id).toBe(id)
    expect(html).toContain("sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")
    expect(html).not.toContain("min-w-[160px]")
  })
  it("oculta prefixos também nos nomes do catálogo, atributos acessíveis e snapshots", () => {
    const data = fixture(), prefix = "CHECKOUT_VISUAL_TEST_1234567890abcdef12345678"
    data.products[0].name = `${prefix} Pomada visual`
    const { controller } = setup(data)
    const catalog = renderToStaticMarkup(createElement(Catalog, { state: controller.getSnapshot(), controller }))
    expect(catalog).toContain('aria-label="Adicionar Pomada visual"')
    expect(catalog).not.toContain(prefix)
    const saved = sale(); saved.items[0].nameSnapshot = `${prefix} Corte visual`
    saved.id = `${prefix}_sale`
    const receipt = renderToStaticMarkup(createElement(Receipt, { state: { ...controller.getSnapshot(), sale: saved }, controller }))
    expect(receipt).toContain("Corte visual")
    expect(receipt).not.toContain(prefix)
    expect(data.products[0].name).toBe(`${prefix} Pomada visual`)
    expect(saved.id).toBe(`${prefix}_sale`)
  })
  it("mantém colunas adaptáveis, acesso mobile e textos do cabeçalho sem largura mínima rígida", () => {
    const { controller } = setup()
    const html = renderToStaticMarkup(createElement(CheckoutScreen, { controller }))
    expect(html).toContain("lg:grid-cols-[minmax(0,1.85fr)_minmax(300px,1fr)]")
    expect(html).toContain("xl:grid-cols-[minmax(0,1.85fr)_minmax(350px,1fr)]")
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain("max-w-full whitespace-normal")
    expect(html).toContain("lg:max-h-[100dvh]")
  })
  it("associa uma explicação clara aos serviços e combos bloqueados por falta de profissional", () => {
    const data = fixture(); data.professionals = []
    const { controller } = setup(data)
    const html = renderToStaticMarkup(createElement(Catalog, { state: controller.getSnapshot(), controller }))
    expect(html).toContain("nenhum profissional habilitado para este serviço")
    expect(html).toContain("todos os serviços deste combo")
    const buttons = html.match(/<button[^>]*aria-label="Adicionar (?:Corte|Barba|Combo)"[^>]*>/g) ?? []
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button).toContain('disabled=""')
      const description = button.match(/aria-describedby="([^"]+)"/)?.[1]
      expect(description).toBeTruthy()
      expect(html).toContain(`id="${description}"`)
    }
  })
  it.each(["draft", "pending", "busy", "retry"])("mantém ação principal fora da rolagem e bloqueio de envio: %s", mode => {
    const { controller } = setup()
    controller.add("SERVICE", "cut")
    const state = { ...controller.getSnapshot(), ...(mode !== "draft" ? { sale: sale(), payments: [cashPayment()], busy: mode === "busy", retry: mode === "retry" } : {}) }
    const html = renderToStaticMarkup(createElement(Receipt, { state, controller }))
    const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"))
    expect(footer).toContain(mode === "draft" ? "Criar comanda e ir ao pagamento" : mode === "busy" ? "Processando…" : "Finalizar venda")
    expect(footer).toContain("shrink-0")
    expect(html).toContain('data-testid="receipt-scroll-area"')
    expect(html).toContain("min-h-0 min-w-0")
    expect(html).not.toContain("max-h-[28rem]")
    expect(html.slice(0, html.indexOf("<footer"))).not.toContain("Finalizar venda</button>")
    if (mode === "busy" || mode === "retry") expect(footer).toContain('disabled=""')
  })
})

describe("Checkout: estado e contratos reais de HTTP", () => {
  it("carrega exclusivamente bootstrap sem tenant, papel ou operador no cliente", async () => {
    const { controller, fetcher } = setup(); await controller.load()
    expect(fetcher.mock.calls[0][0]).toBe("/api/checkout/bootstrap")
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store", credentials: "same-origin" })
  })
  it("bootstrap inicial preenche o vínculo da gorjeta do barbeiro", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(fixture("BARBER")))
    const controller = new CheckoutController(new CheckoutHttp(fetcher))
    await controller.load(); expect(controller.getSnapshot().tipProfessionalId).toBe("pro")
    controller.add("SERVICE", "cut"); controller.set({ tip: "5" }); fetcher.mockResolvedValueOnce(Response.json(sale()))
    await controller.create(); expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).tips).toEqual([{ professionalId: "pro", amountCents: 500 }])
  })
  it("adiciona e remove serviço, combo e produto sem alterar o catálogo", () => {
    const data = fixture(), { controller } = setup(data)
    controller.add("SERVICE", "cut"); controller.add("PACKAGE", "combo"); controller.add("PRODUCT", "pomade")
    expect(controller.getSnapshot().lines.map(line => line.kind)).toEqual(["SERVICE", "PACKAGE", "PRODUCT"])
    for (const line of controller.getSnapshot().lines) controller.remove(line.key)
    expect(controller.getSnapshot().lines).toEqual([]); expect(data.products[0].availableQuantity).toBe(1)
  })
  it("seleção de profissional é enviada na composição real do combo", async () => {
    const data = fixture(); data.professionals.push({ id: "second", name: "Segundo profissional", serviceIds: ["beard"] })
    const { controller, fetcher } = setup(data); controller.add("PACKAGE", "combo")
    controller.assign(controller.getSnapshot().lines[0].key, "beard", "second"); await controller.create()
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).items[0]).toEqual({ kind: "PACKAGE", catalogId: "combo", quantity: 1, components: [{ serviceId: "cut", professionalId: "pro" }, { serviceId: "beard", professionalId: "second" }] })
  })
  it("desconto fixo é enviado somente em centavos sem preço ou comissão do cliente", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); controller.set({ discount: "5,50" }); await controller.create()
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body)); expect(body.discount).toEqual({ kind: "FIXED", amountCents: 550 })
    expect(JSON.stringify(body)).not.toMatch(/price|commission|total|barbershopId|operatorId/)
  })
  it("bloqueia dados locais inválidos antes de chamar o backend", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); controller.set({ tip: "-1" }); await controller.create()
    expect(fetcher).not.toHaveBeenCalled(); expect(controller.getSnapshot().error).toBeTruthy()
  })
  it.each([401, 403, 409, 500])("apresenta HTTP %i sem detalhes internos", async status => {
    const { controller, fetcher } = setup(); fetcher.mockResolvedValueOnce(Response.json({ message: "SECRET_SQL_QUERY_stack" }, { status }))
    await controller.load(); expect(controller.getSnapshot().status).toBe(status)
    expect(controller.getSnapshot().error).not.toContain("SECRET")
    expect(controller.getSnapshot().loading).toBe(false)
  })
  it("busca vazia ou curta não faz requisição e normaliza termo válido", async () => {
    const { controller, fetcher } = setup(); await controller.searchCustomers(""); await controller.searchCustomers("a")
    expect(fetcher).not.toHaveBeenCalled(); await controller.searchCustomers("  Maria   Silva ")
    expect(fetcher.mock.calls[0][0]).toBe("/api/checkout/bootstrap?customerQuery=Maria%20Silva")
  })
  it("resposta atrasada não sobrescreve a busca mais recente", async () => {
    const { controller, fetcher } = setup(); let first!: (response: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
    const old = controller.searchCustomers("Maria"); await controller.searchCustomers("")
    first(Response.json({ ...fixture(), customers: [{ id: "old", name: "Maria" }] })); await old
    expect(controller.getSnapshot().customers).toEqual([])
  })
  it("produto sem estoque e quantidade excedente são bloqueados", () => {
    const { controller } = setup(); controller.add("PRODUCT", "pomade"); controller.add("PRODUCT", "pomade")
    expect(controller.getSnapshot().lines[0].quantity).toBe(1)
    expect(controller.getSnapshot().error).toMatch(/estoque/)
    const data = fixture(); data.products[0].availableQuantity = 0
    const empty = setup(data).controller; empty.add("PRODUCT", "pomade"); expect(empty.getSnapshot().lines).toEqual([])
  })
  it("atribui cada componente do combo somente a profissional habilitado", () => {
    const { controller } = setup(); controller.add("PACKAGE", "combo")
    const line = controller.getSnapshot().lines[0]; expect(line.assignments).toHaveLength(2)
    controller.assign(line.key, "cut", "other-tenant"); expect(controller.getSnapshot().lines[0].assignments[0].professionalId).toBe("pro")
  })
  it("cria venda anônima e bloqueia edição após criação", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create()
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ items: [{ kind: "SERVICE", catalogId: "cut", quantity: 1, professionalId: "pro" }], tips: [] })
    controller.add("PRODUCT", "pomade"); controller.remove(controller.getSnapshot().lines[0].key)
    expect(controller.getSnapshot().lines).toHaveLength(1)
    expect(controller.getSnapshot().sale?.status).toBe("PENDING")
  })
  it("cliente, desconto percentual e gorjeta usam centavos e contratos existentes", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut")
    controller.set({ customer: { id: "customer", name: "Maria" }, discountKind: "PERCENT", discount: "10", tip: "5", tipProfessionalId: "pro" }); await controller.create()
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ customerId: "customer", discount: { kind: "PERCENT", basisPoints: 1000 }, tips: [{ professionalId: "pro", amountCents: 500 }] })
  })
  it.each(["ASSISTANT", "BARBER"] as const)("%s não aplica desconto nem cancela", async role => {
    const { controller, fetcher } = setup(fixture(role)); controller.set({ discount: "10" }); expect(controller.getSnapshot().discount).toBe("")
    controller.add("SERVICE", "cut"); await controller.create(); fetcher.mockClear(); await controller.cancel("Motivo")
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("barbeiro não cria venda apenas de produto nem movimenta caixa", async () => {
    const { controller, fetcher } = setup(fixture("BARBER")); controller.add("PRODUCT", "pomade"); await controller.create(); await controller.cash("SUPPLY", "10", "Teste")
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("duplo clique envia criação uma única vez", async () => {
    const { controller, fetcher } = setup(); let resolve!: (response: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(r => { resolve = r })); controller.add("SERVICE", "cut")
    const first = controller.create(); await controller.create(); expect(fetcher).toHaveBeenCalledTimes(1)
    resolve(Response.json(sale())); await first
  })
  it("resposta perdida mantém payload/chave, bloqueia edição e permite retry", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); fetcher.mockRejectedValueOnce(new TypeError("network"))
    await controller.create(); expect(controller.getSnapshot().retry).toBe(true); controller.add("PRODUCT", "pomade")
    await controller.retry(); expect(controller.getSnapshot().lines).toHaveLength(1)
    expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body)
    expect(fetcher.mock.calls[0][1]?.headers).toEqual(fetcher.mock.calls[1][1]?.headers)
  })
  it("409 mantém comanda pendente e permite atualizar o estoque", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); controller.addPayment()
    controller.payment(controller.getSnapshot().payments[0].id, { amount: "45", confirmed: true }); fetcher.mockResolvedValueOnce(Response.json({}, { status: 409 }))
    await controller.finalize(); expect(controller.getSnapshot()).toMatchObject({ status: 409, retry: false, sale: { status: "PENDING" } })
    await controller.load(); expect(controller.getSnapshot().sale?.status).toBe("PENDING")
  })
  it("finaliza com pagamentos mistos e permite nova venda após sucesso", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); controller.addPayment(); controller.addPayment()
    const [a, b] = controller.getSnapshot().payments
    controller.payment(a.id, { method: "CASH", amount: "20", received: "30", confirmed: true }); controller.payment(b.id, { method: "PIX", amount: "25", confirmed: true })
    fetcher.mockResolvedValueOnce(Response.json(sale("PAID"))); await controller.finalize()
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ cashSessionId: "cash", expectedVersion: 1, payments: [{ method: "CASH", appliedCents: 2000, cashReceivedCents: 3000, confirmed: true }, { method: "PIX", appliedCents: 2500, confirmed: true }] })
    expect(controller.getSnapshot().sale?.status).toBe("PAID"); controller.newSale(); expect(controller.getSnapshot().sale).toBeNull()
  })
  it("caixa fechado impede finalização", async () => {
    const data = fixture(); data.openSessions = []; const { controller, fetcher } = setup(data)
    controller.add("SERVICE", "cut"); await controller.create(); fetcher.mockClear(); await controller.finalize()
    expect(fetcher).not.toHaveBeenCalled(); expect(controller.getSnapshot().error).toMatch(/caixa aberto/)
  })
  it.each(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD"] as const)("finaliza pagamento simples %s com confirmação manual", async method => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); controller.addPayment()
    controller.payment(controller.getSnapshot().payments[0].id, { method, amount: "45", received: "50", confirmed: true })
    fetcher.mockResolvedValueOnce(Response.json(sale("PAID"))); await controller.finalize()
    expect(controller.getSnapshot().sale?.status).toBe("PAID")
    const payment = JSON.parse(String(fetcher.mock.calls[1][1]?.body)).payments[0]
    expect(payment).toMatchObject({ method, appliedCents: 4500, confirmed: true })
    expect("cashReceivedCents" in payment).toBe(method === "CASH")
  })
  it.each(["44", "46"])("não envia finalização com pagamento %s", async value => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); controller.addPayment()
    controller.payment(controller.getSnapshot().payments[0].id, { amount: value, confirmed: true }); fetcher.mockClear(); await controller.finalize()
    expect(fetcher).not.toHaveBeenCalled(); expect(controller.getSnapshot().sale?.status).toBe("PENDING")
  })
  it("não inicia nova comanda enquanto a venda atual estiver pendente", async () => {
    const { controller } = setup(); controller.add("SERVICE", "cut"); await controller.create(); controller.newSale()
    expect(controller.getSnapshot().sale?.status).toBe("PENDING")
  })
  it("cancelamento usa razão e caixa da sessão, sem identidade enviada", async () => {
    const { controller, fetcher } = setup(); fetcher.mockResolvedValueOnce(Response.json(sale("PAID"))); await controller.resume("sale")
    fetcher.mockResolvedValueOnce(Response.json(sale("CANCELED"))); await controller.cancel("Solicitado pelo cliente")
    expect(fetcher.mock.calls[1][0]).toBe("/api/checkout/sales/sale/cancel")
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ reason: "Solicitado pelo cliente", cashSessionId: "cash" })
    fetcher.mockClear(); await controller.cancel("Outra tentativa"); expect(fetcher).not.toHaveBeenCalled()
  })
  it("permite retomar por ID usando GET autorizado e sem listar vendas", async () => {
    const { controller, fetcher } = setup(); fetcher.mockResolvedValueOnce(Response.json(sale()))
    await controller.resume("sale"); expect(fetcher.mock.calls[0][0]).toBe("/api/checkout/sales/sale")
    expect(controller.getSnapshot().sale?.id).toBe("sale")
  })
  it.each(["open", "SUPPLY", "WITHDRAWAL", "close"] as const)("caixa %s usa os endpoints existentes e key de idempotência", async action => {
    const { controller, fetcher } = setup(); await controller.cash(action, "10", "Turno manhã")
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe(action === "open" ? "/api/checkout/cash-sessions/open" : action === "close" ? "/api/checkout/cash-sessions/cash/close" : "/api/checkout/cash-movements")
    expect(options?.headers).toHaveProperty("Idempotency-Key")
  })
  it("dois suprimentos intencionais iguais recebem chaves diferentes após confirmação", async () => {
    const { controller, fetcher } = setup(); await controller.cash("SUPPLY", "10", "Troco"); await controller.cash("SUPPLY", "10", "Troco")
    expect(fetcher.mock.calls[0][1]?.headers).not.toEqual(fetcher.mock.calls[2][1]?.headers)
  })
  it("abertura consulta novamente a sessão e fechamento usa resumo oficial", async () => {
    const data = fixture(); data.openSessions = []; const { controller, fetcher } = setup(data)
    fetcher.mockResolvedValueOnce(Response.json({ id: "cash", status: "OPEN" })).mockResolvedValueOnce(Response.json(fixture()))
    await controller.cash("open", "100", "Manhã"); expect(controller.getSnapshot().data?.openSessions[0].id).toBe("cash")
    const closed = { id: "cash", status: "CLOSED", expectedBalanceCents: 10300, countedBalanceCents: 10000, differenceCents: -300 }
    fetcher.mockResolvedValueOnce(Response.json(closed)).mockResolvedValueOnce(Response.json(data))
    await controller.cash("close", "100", "Contagem"); expect(controller.getSnapshot().cashResult).toEqual(closed)
    expect(renderToStaticMarkup(createElement(CashPanel, { controller, state: controller.getSnapshot() }))).toContain("Fechamento confirmado")
  })
  it.each(["finalize", "cancel", "cash"] as const)("resposta perdida de %s conserva exatamente a tentativa", async action => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); controller.addPayment()
    controller.payment(controller.getSnapshot().payments[0].id, { amount: "45", confirmed: true })
    if (action === "cancel") { fetcher.mockResolvedValueOnce(Response.json(sale("PAID"))); await controller.readSale() }
    fetcher.mockClear()
    fetcher.mockRejectedValueOnce(new TypeError("network"))
    if (action === "finalize") await controller.finalize()
    else if (action === "cancel") await controller.cancel("Motivo")
    else await controller.cash("WITHDRAWAL", "10", "Troco")
    expect(controller.getSnapshot().retry).toBe(true); await controller.retry()
    expect(fetcher.mock.calls[0][0]).toBe(fetcher.mock.calls[1][0]); expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body)
    expect(fetcher.mock.calls[0][1]?.headers).toEqual(fetcher.mock.calls[1][1]?.headers)
  })
  it("timeout aborta a requisição e mantém a chave da tentativa", async () => {
    vi.useFakeTimers()
    try {
      const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))) }))
      const http = new CheckoutHttp(fetcher), first = expect(http.post("sales", { items: [] })).rejects.toThrow("Aborted")
      await vi.advanceTimersByTimeAsync(25000); await first
      fetcher.mockResolvedValueOnce(Response.json({})); await http.post("sales", { items: [] })
      expect(fetcher.mock.calls[0][1]?.headers).toEqual(fetcher.mock.calls[1][1]?.headers)
    } finally { vi.useRealTimers() }
  })
})

describe("Checkout: limpeza local, descarte e cancelamento financeiro distintos", () => {
  it("limpa somente o carrinho local após confirmação, sem HTTP ou nova intenção", () => {
    const { controller, fetcher, http } = setup(), newIntent = vi.spyOn(http, "newIntent"), close = vi.fn()
    controller.add("SERVICE", "cut"); controller.add("PRODUCT", "pomade")
    controller.set({ customer: { id: "customer", name: "Cliente" }, discount: "5", tip: "2" })
    const data = controller.getSnapshot().data
    const confirm = ClearConfirmation({ state: controller.getSnapshot(), controller, onClose: close })
    expect(controller.getSnapshot().lines).toHaveLength(2)
    action(confirm, "Confirmar limpeza da comanda")?.()
    expect(controller.getSnapshot()).toMatchObject({ lines: [], customer: null, discount: "", tip: "", payments: [], sale: null })
    expect(controller.getSnapshot().data).toBe(data)
    expect(fetcher).not.toHaveBeenCalled(); expect(newIntent).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce()
  })
  it("a confirmação local explica a limpeza e não menciona reversões", () => {
    const { controller } = setup(); controller.add("SERVICE", "cut")
    const html = renderToStaticMarkup(createElement(Dialog, { open: true }, createElement(ClearConfirmation, { state: controller.getSnapshot(), controller, onClose: vi.fn() })))
    expect(html).toContain("Limpar comanda?"); expect(html).toContain("somente deste dispositivo")
    expect(html).not.toMatch(/revertid|estorn|Revers/)
  })
  it("permite limpar cliente e ajustes locais mesmo quando ainda não existem itens", () => {
    const { controller, fetcher } = setup(); controller.set({ customer: { id: "customer", name: "Cliente" }, discount: "5", tip: "2" })
    const html = renderToStaticMarkup(createElement(Receipt, { state: controller.getSnapshot(), controller }))
    const button = html.slice(html.lastIndexOf("<button", html.indexOf("Limpar comanda")), html.indexOf("Limpar comanda"))
    expect(button).not.toContain('disabled=""')
    controller.clearCart(); expect(controller.getSnapshot()).toMatchObject({ lines: [], customer: null, discount: "", tip: "" })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("não permite limpar uma comanda persistida", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create()
    const before = controller.getSnapshot(); fetcher.mockClear(); controller.clearCart()
    expect(controller.getSnapshot()).toBe(before); expect(fetcher).not.toHaveBeenCalled()
  })
  it("não limpa nem abandona uma tentativa de criação de resultado incerto", async () => {
    const { controller, fetcher, http } = setup(), newIntent = vi.spyOn(http, "newIntent")
    controller.add("SERVICE", "cut"); fetcher.mockRejectedValueOnce(new TypeError("network")); await controller.create()
    const before = controller.getSnapshot(); controller.clearCart()
    expect(controller.getSnapshot()).toBe(before); expect(before.retry).toBe(true); expect(newIntent).not.toHaveBeenCalled()
    await controller.retry()
    expect(fetcher.mock.calls[0][1]?.headers).toEqual(fetcher.mock.calls[1][1]?.headers)
  })
  it.each(["BARBERSHOP_OWNER", "ASSISTANT", "BARBER"] as const)("%s vê descarte no rodapé, separado de cancelamento financeiro", async role => {
    const { controller } = setup(fixture(role)); controller.add("SERVICE", "cut"); await controller.create()
    const html = renderToStaticMarkup(createElement(Receipt, { state: controller.getSnapshot(), controller }))
    const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"))
    expect(footer).toContain("Finalizar venda"); expect(footer).toContain("Descartar comanda"); expect(footer).toContain("text-destructive")
    expect(html.slice(0, html.indexOf("<footer"))).not.toContain("Descartar comanda</button>")
    expect(html).not.toContain("Cancelar venda")
  })
  it("confirma descarte com motivo obrigatório e explicação sem reversões", async () => {
    const { controller } = setup(); controller.add("SERVICE", "cut"); await controller.create()
    const html = renderToStaticMarkup(createElement(Dialog, { open: true }, createElement(DiscardConfirmation, { state: controller.getSnapshot(), controller, reason: "   ", onReasonChange: vi.fn(), onClose: vi.fn() })))
    expect(html).toContain("Esta comanda ainda não foi paga. Nenhuma movimentação financeira será realizada.")
    expect(html).toContain("Motivo do descarte"); expect(html).toContain('required=""')
    const confirm = html.slice(html.lastIndexOf("<button", html.indexOf("Confirmar descarte")), html.indexOf("Confirmar descarte"))
    expect(confirm).toContain('disabled=""'); expect(html).not.toMatch(/revertid|estorn|comissões serão/)
  })
  it.each(["", "   "])("não envia descarte sem motivo significativo: %j", async reason => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); fetcher.mockClear()
    await controller.discard(reason)
    expect(fetcher).not.toHaveBeenCalled(); expect(controller.getSnapshot().error).toBe("Informe o motivo do descarte.")
    expect(controller.getSnapshot().sale?.status).toBe("PENDING")
  })
  it.each(["BARBERSHOP_OWNER", "ASSISTANT", "BARBER"] as const)("%s envia somente motivo e versão para descarte autorizado pelo servidor", async role => {
    const { controller, fetcher } = setup(fixture(role)); controller.add("SERVICE", "cut"); await controller.create()
    controller.addPayment(); controller.payment(controller.getSnapshot().payments[0].id, { amount: "45", confirmed: true })
    const before = controller.getSnapshot().sale
    fetcher.mockClear(); fetcher.mockResolvedValueOnce(Response.json({ ...sale("VOIDED"), version: 2 }))
    await controller.discard("  Desistência do cliente  ")
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe("/api/checkout/sales/sale/void")
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ reason: "Desistência do cliente", expectedVersion: 1 })
    expect(fetcher.mock.calls[0][1]?.headers).toHaveProperty("Idempotency-Key")
    expect(controller.getSnapshot().payments).toEqual([])
    expect(controller.getSnapshot().sale?.items).toEqual(before?.items)
    expect(controller.getSnapshot().notice).toBe("Comanda descartada. Nenhuma movimentação financeira foi realizada.")
  })
  it.each(["PAID", "VOIDED", "CANCELED"] as const)("não descarta estado %s", async status => {
    const { controller, fetcher } = setup(); fetcher.mockResolvedValueOnce(Response.json(sale(status))); await controller.resume("sale"); fetcher.mockClear()
    await controller.discard("Tentativa inválida")
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("não transforma uma PENDING em cancelamento financeiro", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); fetcher.mockClear()
    await controller.cancel("Motivo")
    expect(fetcher).not.toHaveBeenCalled(); expect(controller.getSnapshot().sale?.status).toBe("PENDING")
  })
  it("mensagens de criação, finalização e cancelamento são específicas do resultado", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create()
    expect(controller.getSnapshot().notice).toBe("Comanda criada. Confirme os pagamentos para finalizar.")
    controller.addPayment(); controller.payment(controller.getSnapshot().payments[0].id, { amount: "45", confirmed: true })
    fetcher.mockResolvedValueOnce(Response.json(sale("PAID"))); await controller.finalize()
    expect(controller.getSnapshot().notice).toBe("Venda finalizada com sucesso.")
    fetcher.mockResolvedValueOnce(Response.json(sale("CANCELED"))); await controller.cancel("Solicitado pelo cliente")
    expect(controller.getSnapshot().notice).toBe("Venda cancelada. Os lançamentos aplicáveis foram revertidos.")
  })
  it("VOIDED preserva snapshots, motivo, autor e horário em visualização somente leitura", async () => {
    const { controller, fetcher } = setup(), saved: Sale = { ...sale("VOIDED"), closureKind: "VOIDED", voidedAt: "2026-10-24T16:00:00Z", voidedByName: "Operador do descarte", voidReason: "Cliente desistiu" }
    fetcher.mockResolvedValueOnce(Response.json(saved)); await controller.resume("sale")
    const html = renderToStaticMarkup(createElement(Receipt, { state: controller.getSnapshot(), controller }))
    for (const label of ["Descartada", "Cliente desistiu", "Operador do descarte", 'dateTime="2026-10-24T16:00:00Z"', "Corte histórico", "Total confirmado", "Nova venda"]) expect(html).toContain(label)
    expect(html).not.toMatch(/Reversões processadas|Finalizar venda|Cancelar venda|Confirmar descarte|A finalização revalida/)
    controller.add("PRODUCT", "pomade"); controller.addPayment(); controller.set({ tip: "10" })
    expect(controller.getSnapshot().sale).toEqual(saved); expect(controller.getSnapshot().tip).toBe("")
    controller.newSale(); expect(controller.getSnapshot().sale).toBeNull()
  })
  it("CANCELED legado permanece com status original e sem mensagem de reversão", async () => {
    const { controller, fetcher } = setup(), saved: Sale = { ...sale("CANCELED"), finalizedAt: null, cancellationReason: "Encerrada antes do pagamento", canceledByName: "Operador legado" }
    fetcher.mockResolvedValueOnce(Response.json(saved)); await controller.resume("sale")
    const html = renderToStaticMarkup(createElement(Receipt, { state: controller.getSnapshot(), controller }))
    expect(html).toContain("Descartada (legado)"); expect(html).toContain("Nenhuma movimentação financeira foi realizada.")
    expect(html).toContain("Encerrada antes do pagamento"); expect(html).toContain("Operador legado")
    expect(html).not.toMatch(/Venda cancelada|revertidos|Reversões processadas/)
    expect(controller.getSnapshot().sale?.status).toBe("CANCELED")
  })
  it("cancelamento financeiro de PAID permanece exclusivo do proprietário", async () => {
    const { controller, fetcher } = setup(); fetcher.mockResolvedValueOnce(Response.json(sale("PAID"))); await controller.resume("sale")
    const html = renderToStaticMarkup(createElement(Receipt, { state: controller.getSnapshot(), controller }))
    expect(html).toContain("Cancelar venda"); expect(html).not.toContain("Descartar comanda")
    fetcher.mockResolvedValueOnce(Response.json(sale("CANCELED"))); await controller.cancel("Cancelamento real")
    const canceled = renderToStaticMarkup(createElement(Receipt, { state: controller.getSnapshot(), controller }))
    expect(canceled).toContain("Os lançamentos aplicáveis foram revertidos.")
    expect(canceled).not.toContain("Nenhuma movimentação financeira")
  })
  it.each(["discard", "finalize"] as const)("bloqueia duplo envio e ação concorrente enquanto %s aguarda", async firstAction => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); controller.addPayment()
    controller.payment(controller.getSnapshot().payments[0].id, { amount: "45", confirmed: true }); fetcher.mockClear()
    let resolve!: (response: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const first = firstAction === "discard" ? controller.discard("Desistência") : controller.finalize()
    await controller.discard("Outra tentativa"); await controller.finalize(); controller.clearCart()
    expect(fetcher).toHaveBeenCalledTimes(1)
    const html = renderToStaticMarkup(createElement(Receipt, { state: controller.getSnapshot(), controller }))
    const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"))
    const discard = footer.slice(footer.lastIndexOf("<button", footer.indexOf("Descartar comanda")), footer.indexOf("Descartar comanda"))
    expect(discard).toContain('disabled=""')
    resolve(Response.json(sale(firstAction === "discard" ? "VOIDED" : "PAID"))); await first
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1)
  })
  it("descarte de resultado incerto repete payload e chave sem liberar alterações", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); fetcher.mockClear()
    fetcher.mockRejectedValueOnce(new TypeError("network")); await controller.discard("Cliente desistiu")
    expect(controller.getSnapshot().retry).toBe(true)
    controller.clearCart(); await controller.discard("Outro motivo"); await controller.finalize()
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockResolvedValueOnce(Response.json(sale("VOIDED"))); await controller.retry()
    expect(fetcher.mock.calls[0][1]?.headers).toEqual(fetcher.mock.calls[1][1]?.headers)
    expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body)
    expect(controller.getSnapshot().sale?.status).toBe("VOIDED"); expect(controller.getSnapshot().retry).toBe(false)
  })
  it.each([401, 403, 409, 500])("descarte HTTP %s preserva estado e erro público seguro", async status => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); fetcher.mockClear()
    fetcher.mockResolvedValueOnce(Response.json({ message: "PRIVATE_SQL_SECRET" }, { status })); await controller.discard("Desistência")
    expect(controller.getSnapshot()).toMatchObject({ status, sale: { status: "PENDING" }, retry: status >= 500 })
    expect(controller.getSnapshot().error).not.toContain("PRIVATE")
    expect(controller.getSnapshot().notice).toBeNull()
  })
})

describe("Checkout: valores e pagamentos", () => {
  it.each([["12,34", 1234], ["0.01", 1], ["100", 10000]])("converte %s para centavos inteiros", (input, expected) => { expect(amount(input)).toBe(expected) })
  it.each(["-1", "1.234", "Infinity", "1e3", "21474836.48"])("recusa valor inválido %s", input => { expect(() => amount(input)).toThrow() })
  it("calcula estimativa com desconto fixo, percentual e gorjeta separada", () => {
    const { controller } = setup(); controller.add("SERVICE", "cut"); const lines = controller.getSnapshot().lines
    expect(estimate(lines, "FIXED", "5", "10").totalCents).toBe(5000)
    expect(estimate(lines, "PERCENT", "10", "10").totalCents).toBe(5050)
    expect(() => estimate(lines, "PERCENT", "101", "0")).toThrow()
  })
  it.each(["44", "46"])("recusa pagamento insuficiente ou excedente %s", value => { expect(() => paymentInput([cashPayment(value)], 4500)).toThrow(/exatamente/) })
  it("troco somente em dinheiro e confirmação obrigatória", () => {
    expect(paymentInput([{ ...cashPayment(), method: "PIX" }], 4500)[0]).not.toHaveProperty("cashReceivedCents")
    expect(() => paymentInput([cashPayment("45", "44")], 4500)).toThrow(/insuficiente/)
    expect(() => paymentInput([{ ...cashPayment(), confirmed: false }], 4500)).toThrow(/Confirme/)
    expect(paymentInput([], 0)).toEqual([])
  })
})

describe("Checkout: componentes renderizados com o mesmo controlador da interface", () => {
  it("renderiza tela completa, título, navegação mobile e colunas responsivas", () => {
    const { controller } = setup(), html = renderToStaticMarkup(createElement(CheckoutScreen, { controller }))
    expect(html).toContain("PDV &amp; Checkout"); expect(html).toContain("Abrir navegação"); expect(html).toContain("xl:grid-cols-[minmax(0,1.85fr)_minmax(350px,1fr)]"); expect(html).toContain("Comanda de caixa")
  })
  it("renderiza skeleton e 401 com retorno ao login sem catálogo", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 401 }))
    const controller = new CheckoutController(new CheckoutHttp(fetcher))
    expect(renderToStaticMarkup(createElement(CheckoutScreen, { controller }))).toContain("Carregando Checkout")
    await controller.load(); const html = renderToStaticMarkup(createElement(CheckoutScreen, { controller }))
    expect(html).toContain('role="alert"'); expect(html).toContain('href="/login"'); expect(html).not.toContain("Catálogo do Checkout")
  })
  it("catálogo acessível, sem dados artificiais, com grade responsiva e estoque real", () => {
    const { controller } = setup(); const html = renderToStaticMarkup(createElement(Catalog, { controller, state: controller.getSnapshot() }))
    expect(html).toContain('aria-label="Catálogo do Checkout"'); expect(html).toContain("Adicionar Corte"); expect(html).toContain("1 un. disponíveis"); expect(html).toContain("sm:grid-cols-2")
  })
  it("vazio explícito e sem caixa configurado", () => {
    const data = fixture(); data.services = []; data.packages = []; data.products = []; data.cashRegisters = []; data.openSessions = []
    const { controller } = setup(data), props = { controller, state: controller.getSnapshot() }
    expect(renderToStaticMarkup(createElement(Catalog, props))).toContain("Catálogo vazio: nenhum item ativo")
    expect(renderToStaticMarkup(createElement(CashPanel, props))).toContain("Nenhum caixa ativo")
  })
  it.each(["BARBER", "ASSISTANT"] as const)("%s não recebe controles de desconto ou cancelamento", role => {
    const { controller } = setup(fixture(role)); const html = renderToStaticMarkup(createElement(Receipt, { controller, state: controller.getSnapshot() }))
    expect(html).not.toContain("Valor do desconto"); expect(html).not.toContain("Cancelar venda"); expect(html).toContain("Cliente (opcional)")
  })
  it("barbeiro não recebe controles de movimentação de caixa", () => {
    const { controller } = setup(fixture("BARBER")), html = renderToStaticMarkup(createElement(CashPanel, { controller, state: controller.getSnapshot() }))
    expect(html).not.toContain(">Sangria<"); expect(html).not.toContain(">Fechar caixa<")
  })
  it("pendente mostra snapshot oficial, pagamentos e finalização", async () => {
    const { controller } = setup(); controller.add("SERVICE", "cut"); await controller.create()
    const html = renderToStaticMarkup(createElement(Receipt, { controller, state: controller.getSnapshot() }))
    expect(html).toContain("Corte histórico"); expect(html).toContain("Total confirmado"); expect(html).toContain("Finalizar venda"); expect(html).toContain("Descartar comanda"); expect(html).not.toContain("Cancelar venda")
  })
  it("venda recuperada com cliente não é apresentada como anônima", async () => {
    const { controller, fetcher } = setup(); fetcher.mockResolvedValueOnce(Response.json({ ...sale(), customerId: "customer" })); await controller.resume("sale")
    const html = renderToStaticMarkup(createElement(Receipt, { controller, state: controller.getSnapshot() }))
    expect(html).toContain("Cliente vinculado à venda"); expect(html).not.toContain("venda anônima")
  })
  it("cabeçalho único reúne operador, caixa, saldo inicial e ações reais", () => {
    const data = fixture(); data.openSessions[0] = { ...data.openSessions[0], openingBalanceCents: 5000, operatorName: "Operador da abertura", openedAt: "2026-10-22T12:00:00Z" }
    const { controller } = setup(data), html = renderToStaticMarkup(createElement(CheckoutScreen, { controller }))
    const header = html.slice(0, html.indexOf("</header>"))
    for (const text of ["PDV &amp; Checkout", "Operador: Operador", "Recepção", "Caixa aberto", "Saldo inicial", "Suprimento", "Sangria", "Fechar caixa"]) expect(header).toContain(text)
    expect(html.match(/aria-label="Controle do caixa"/g)).toHaveLength(1)
    expect(header).not.toContain("Saldo em caixa")
  })
  it("comanda tem rolagem desktop, alvo de foco e acesso mobile com quantidade/estimativa", () => {
    const { controller } = setup(); controller.add("SERVICE", "cut"); controller.add("PRODUCT", "pomade")
    const html = renderToStaticMarkup(createElement(CheckoutScreen, { controller }))
    expect(html).toContain('id="checkout-receipt" tabindex="-1"')
    expect(html).toContain("lg:sticky"); expect(html).toContain("lg:max-h-[100dvh]")
    expect(html).toContain('aria-haspopup="dialog"'); expect(html).toContain("Ver comanda: 2 itens, total estimado")
    expect(html).toContain("Etapas da venda"); expect(html).toContain("md:hidden")
  })
  it("cards distinguem categoria, duração, estoque baixo e indisponibilidade", () => {
    const data = fixture(); data.services[0].category = { id: "category", name: "Cortes" }
    const { controller } = setup(data)
    const html = renderToStaticMarkup(createElement(Catalog, { controller, state: controller.getSnapshot() }))
    expect(html).toContain("Cortes"); expect(html).toContain("30 min"); expect(html).toContain("Estoque baixo"); expect(html).toContain('data-availability="low-stock"')
    data.products[0].availableQuantity = 0
    const empty = setup(data).controller, unavailable = renderToStaticMarkup(createElement(Catalog, { controller: empty, state: empty.getSnapshot() }))
    expect(unavailable).toContain('data-availability="unavailable"'); expect(unavailable).toContain("Sem estoque")
    expect(unavailable.match(/<button[^>]*aria-label="Adicionar Pomada"[^>]*>/)?.[0]).toContain('disabled=""')
  })
  it("quantidade mantém labels e ações limitadas ao estoque informado", () => {
    const { controller } = setup(); controller.add("PRODUCT", "pomade")
    const html = renderToStaticMarkup(createElement(Receipt, { controller, state: controller.getSnapshot() }))
    expect(html).toContain("Quantidade de Pomada")
    expect(html.match(/<button[^>]*aria-label="Aumentar quantidade de Pomada"[^>]*>/)?.[0]).toContain('disabled=""')
    expect(html.match(/<button[^>]*aria-label="Diminuir quantidade de Pomada"[^>]*>/)?.[0]).toContain('disabled=""')
    expect(html).toContain("Remover Pomada")
  })
  it("total confirmado e acesso mobile usam a venda do servidor, sem reaproveitar estimativa", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut")
    fetcher.mockResolvedValueOnce(Response.json({ ...sale(), servicesSubtotalCents: 9900, totalCents: 9900, items: [{ ...sale().items[0], quantity: 2, totalCents: 9900 }] }))
    await controller.create()
    const receipt = renderToStaticMarkup(createElement(Receipt, { controller, state: controller.getSnapshot() }))
    expect(receipt).toContain("99,00"); expect(receipt).not.toContain("45,00"); expect(receipt).toContain("Total confirmado")
    const screen = renderToStaticMarkup(createElement(CheckoutScreen, { controller }))
    expect(screen).toContain("Ver comanda: 2 itens, total confirmado")
  })
  it("pagamento misto mantém seleção real, recebimento manual, troco e botão final sem bloqueio indevido", async () => {
    const { controller } = setup(); controller.add("SERVICE", "cut"); await controller.create(); controller.addPayment(); controller.addPayment()
    const [a, b] = controller.getSnapshot().payments
    controller.payment(a.id, { method: "CASH", amount: "20", received: "30", confirmed: true })
    controller.payment(b.id, { method: "PIX", amount: "25", confirmed: true })
    const html = renderToStaticMarkup(createElement(Receipt, { controller, state: controller.getSnapshot() }))
    for (const text of ["Pagamento misto", "Dinheiro recebido 1", "Troco em dinheiro", "10,00", "Recebimento confirmado", "Adicionar pagamento em PIX manual", "Adicionar pagamento em Dinheiro", "Finalizar venda"]) expect(html).toContain(text)
    // Isolate the final button instead of counting all disabled optional controls.
    const finalButton = html.slice(html.lastIndexOf('<button', html.indexOf("Finalizar venda")), html.indexOf("Finalizar venda"))
    expect(finalButton).toContain("<button")
    expect(finalButton).not.toContain('disabled=""')
  })
  it("bloqueio da tentativa pendente também aparece nos controles visuais", async () => {
    const { controller, fetcher } = setup(); let resolve!: (response: Response) => void
    controller.add("SERVICE", "cut"); fetcher.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const pending = controller.create(), html = renderToStaticMarkup(createElement(Receipt, { controller, state: controller.getSnapshot() }))
    expect(html).toContain("Processando…"); expect(html.match(/<button[^>]*aria-label="Remover Corte"[^>]*>/)?.[0]).toContain('disabled=""')
    resolve(Response.json(sale())); await pending
  })
  it("Finalizar bloqueia duplo envio e fica desabilitado enquanto aguarda o servidor", async () => {
    const { controller, fetcher } = setup(); controller.add("SERVICE", "cut"); await controller.create(); controller.addPayment()
    controller.payment(controller.getSnapshot().payments[0].id, { amount: "45", confirmed: true }); fetcher.mockClear()
    let resolve!: (response: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const first = controller.finalize(); await controller.finalize()
    expect(fetcher).toHaveBeenCalledTimes(1)
    const html = renderToStaticMarkup(createElement(Receipt, { controller, state: controller.getSnapshot() }))
    const button = html.slice(html.lastIndexOf("<button", html.indexOf("Processando…")), html.indexOf("Processando…"))
    expect(button).toContain('disabled=""')
    resolve(Response.json(sale("PAID"))); await first
    expect(fetcher.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
    expect(controller.getSnapshot().sale?.status).toBe("PAID")
  })
  it.each(["ASSISTANT", "BARBER"] as const)("%s não recebe cancelamento ou desconto mesmo após finalizar", async role => {
    const { controller, fetcher } = setup(fixture(role)); fetcher.mockResolvedValueOnce(Response.json(sale("PAID"))); await controller.resume("sale")
    const html = renderToStaticMarkup(createElement(CheckoutScreen, { controller }))
    expect(html).not.toContain("Cancelar venda"); expect(html).not.toContain("Valor do desconto")
    if (role === "BARBER") { expect(html).not.toContain(">Sangria<"); expect(html).not.toContain(">Fechar caixa<"); expect(html).not.toContain("Saldo inicial") }
    expect(html).toContain("Nova venda")
  })
  it("não introduz ações sem contrato, dados da imagem ou uma segunda sidebar", () => {
    const { controller } = setup(), html = renderToStaticMarkup(createElement(CheckoutScreen, { controller }))
    expect(html).not.toMatch(/Leitor de Código|Puxar da Agenda|Cupom|VIP10|Histórico de Vendas|WhatsApp|Imprimir|Tiago Ferreira|Gabriel Santos/)
    expect(html).not.toContain('role="navigation"'); expect(html).toContain("Recuperar venda")
    expect(html).not.toContain("bootstrap")
  })
})
