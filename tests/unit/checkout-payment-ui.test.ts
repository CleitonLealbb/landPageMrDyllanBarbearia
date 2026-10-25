import { Children, createElement, isValidElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CheckoutController, type CheckoutState } from "@/features/checkout/controller"
import { CheckoutHttp } from "@/features/checkout/http"
import { FinalizeAction, Payments } from "@/features/checkout/components/payments"
import type { Bootstrap, Method, PaymentDraft, Sale } from "@/features/checkout/types"

function fixture(): Bootstrap {
  return { operator: { id: "operator", name: "Operador", role: "BARBERSHOP_OWNER", professionalId: null, permissions: { sell: true, cash: true, discount: true, cancel: true } }, services: [], packages: [], professionals: [], products: [], customers: [], cashRegisters: [{ id: "register", name: "Recepção" }], openSessions: [{ id: "session", cashRegisterId: "register", status: "OPEN" }] }
}
function payment(id: string, method: Method, amount: string, change: Partial<PaymentDraft> = {}): PaymentDraft {
  return { id, method, amount, received: method === "CASH" ? amount : "", confirmed: false, amountMode: "AUTO", receivedMode: "AUTO", ...change }
}
function setup(payments: PaymentDraft[], totalCents = 11500) {
  const controller = new CheckoutController(new CheckoutHttp(vi.fn()), fixture())
  const sale: Sale = { id: "sale", status: "PENDING", version: 1, customerId: null, servicesSubtotalCents: totalCents, productsSubtotalCents: 0, discountCents: 0, tipCents: 0, totalCents, createdAt: "2026-10-24T12:00:00Z", finalizedAt: null, canceledAt: null, items: [], tips: [], payments: [] }
  const state: CheckoutState = { ...controller.getSnapshot(), sale, payments }
  const html = () => renderToStaticMarkup(createElement(Payments, { state, controller }))
  return { controller, state, html }
}
type ActionProps = { children?: ReactNode; "aria-label"?: string; onClick?: () => void; disabled?: boolean; type?: string; checked?: boolean; onChange?: (event: { target: { checked: boolean } }) => void }
function find(node: ReactNode, matches: (props: ActionProps) => boolean): ActionProps | undefined {
  if (!isValidElement<ActionProps>(node)) return
  if (matches(node.props)) return node.props
  return Children.toArray(node.props.children).map(child => find(child, matches)).find(Boolean)
}
function action(node: ReactNode, label: string) {
  const result = find(node, props => props["aria-label"] === label)
  expect(result).toBeDefined()
  return result!
}
function summary(html: string, label: string) {
  return html.slice(html.indexOf(`<dt>${label}</dt>`)).split("</dd>")[0]
}

describe("Pagamento misto: interface acessível e preenchimento assistido", () => {
  it("separa total da venda, informado, confirmado, restante e troco sem antecipar confirmação", () => {
    const { html } = setup([payment("pix", "PIX", "100,00", { confirmed: true }), payment("cash", "CASH", "15,00", { received: "20,00", receivedMode: "MANUAL" })])
    const markup = html()
    expect(summary(markup, "Total da venda")).toContain("115,00")
    expect(summary(markup, "Total informado")).toContain("115,00")
    expect(summary(markup, "Total confirmado")).toContain("100,00")
    expect(summary(markup, "Valor restante")).toContain("0,00")
    expect(summary(markup, "Troco em dinheiro")).toContain("5,00")
    expect(markup).toContain('aria-label="Resumo dos pagamentos" aria-live="polite"')
    expect(markup).not.toContain("Pagamento completo")
    expect(markup).toContain("confirme cada recebimento para finalizar")
  })

  it("mostra Pagamento completo somente com valores corretos e confirmação manual de cada linha", () => {
    const { html } = setup([payment("pix", "PIX", "100,00", { confirmed: true }), payment("cash", "CASH", "15,00", { received: "20,00", confirmed: true })])
    expect(html()).toContain("Pagamento completo")
    expect(summary(html(), "Total confirmado")).toContain("115,00")
  })

  it("distingue valor automático e manual e permite restaurar o restante por ação explícita", () => {
    const { controller, state, html } = setup([payment("pix", "PIX", "100,00", { amountMode: "MANUAL" }), payment("cash", "CASH", "15,00")])
    const reset = vi.spyOn(controller, "usePaymentRemaining").mockImplementation(() => {})
    const markup = html()
    expect(markup).toContain("Valor editado manualmente")
    expect(markup).toContain("Valor automático; acompanha o restante")
    expect(markup.match(/>Usar valor restante<\/button>/g)).toHaveLength(2)
    action(Payments({ state, controller }), "Usar valor restante no pagamento 1").onClick?.()
    expect(reset).toHaveBeenCalledExactlyOnceWith("pix")
  })

  it.each(["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH"] as const)("adiciona %s em uma operação com o método escolhido", method => {
    const { controller, state } = setup([])
    const add = vi.spyOn(controller, "addPayment").mockImplementation(() => {})
    const labels = { PIX: "PIX manual", CREDIT_CARD: "Cartão de crédito manual", DEBIT_CARD: "Cartão de débito manual", CASH: "Dinheiro" }
    action(Payments({ state, controller }), `Adicionar pagamento em ${labels[method]}`).onClick?.()
    expect(add).toHaveBeenCalledExactlyOnceWith(method)
  })

  it.each(["PIX", "CREDIT_CARD", "DEBIT_CARD"] as const)("explica excesso em %s e associa a mensagem aos campos, impedindo confirmar", method => {
    const { state, controller, html } = setup([payment("first", "PIX", "100,00", { confirmed: true }), payment("second", method, "16,00", { amountMode: "MANUAL" })])
    const markup = html(), node = Payments({ state, controller })
    expect(markup).toContain('id="payment-second-error" role="alert"')
    expect(markup).toContain('aria-invalid="true" aria-describedby="payment-second-details payment-second-error"')
    expect(markup).toMatch(/restante|excede|excedente/)
    expect(summary(markup, "Valor aplicado excedente")).toContain("1,00")
    expect(summary(markup, "Valor restante")).toContain("0,00")
    const checkbox = find(node, props => props.type === "checkbox" && !props.checked)
    expect(checkbox?.disabled).toBe(true)
    expect(markup).not.toContain("Pagamento completo")
  })

  it("protege valor, método, dinheiro recebido, remoção e autoajuste já confirmados, mas permite desconfirmar", () => {
    const { controller, state, html } = setup([payment("cash", "CASH", "115,00", { received: "120,00", confirmed: true })])
    const change = vi.spyOn(controller, "payment").mockImplementation(() => {})
    const markup = html(), node = Payments({ state, controller })
    expect(markup.match(/<input[^>]*disabled=""/g)).toHaveLength(2)
    expect(markup.match(/<select[^>]*disabled=""/g)).toHaveLength(1)
    expect(action(node, "Remover pagamento 1").disabled).toBe(true)
    expect(action(node, "Usar valor restante no pagamento 1").disabled).toBe(true)
    const checkbox = find(node, props => props.type === "checkbox")
    expect(checkbox?.disabled).toBe(false)
    checkbox?.onChange?.({ target: { checked: false } })
    expect(change).toHaveBeenCalledExactlyOnceWith("cash", { confirmed: false })
    expect(markup).toContain("Desconfirme para editar")
  })

  it("mantém remoção explícita somente para pagamento não confirmado", () => {
    const { controller, state } = setup([payment("pix", "PIX", "100,00"), payment("cash", "CASH", "15,00")])
    const remove = vi.spyOn(controller, "removePayment").mockImplementation(() => {})
    action(Payments({ state, controller }), "Remover pagamento 1").onClick?.()
    expect(remove).toHaveBeenCalledExactlyOnceWith("pix")
  })

  it("não oferece restante calculado a partir de outra entrada decimal ainda incompleta", () => {
    const { controller, state, html } = setup([payment("pix", "PIX", "100,", { amountMode: "MANUAL" }), payment("cash", "CASH", "15,00")])
    const node = Payments({ state, controller })
    expect(action(node, "Usar valor restante no pagamento 2").disabled).toBe(true)
    expect(html()).toContain("Conclua os valores dos outros pagamentos para calcular o restante")
    expect(html()).not.toContain("Pagamento completo")
  })

  it.each(["busy", "retry"] as const)("bloqueia todos os ajustes durante %s, sem desconfirmar implicitamente", flag => {
    const { controller, state } = setup([payment("cash", "CASH", "115,00", { confirmed: true })])
    state[flag] = true
    const node = Payments({ state, controller })
    expect(action(node, "Adicionar pagamento em PIX manual").disabled).toBe(true)
    expect(action(node, "Usar valor restante no pagamento 1").disabled).toBe(true)
    expect(find(node, props => props.type === "checkbox")?.disabled).toBe(true)
    expect(state.payments[0].confirmed).toBe(true)
  })

  it.each([
    { description: "pagamento insuficiente", payments: [payment("pix", "PIX", "100,00", { confirmed: true })], disabled: true },
    { description: "pagamento não confirmado", payments: [payment("pix", "PIX", "115,00")], disabled: true },
    { description: "PIX excedente", payments: [payment("pix", "PIX", "116,00", { confirmed: true })], disabled: true },
    { description: "dinheiro recebido insuficiente", payments: [payment("cash", "CASH", "115,00", { received: "100,00", confirmed: true })], disabled: true },
    { description: "dinheiro com troco correto", payments: [payment("pix", "PIX", "100,00", { confirmed: true }), payment("cash", "CASH", "15,00", { received: "20,00", confirmed: true })], disabled: false },
  ])("finalização respeita $description", ({ payments, disabled }) => {
    const { controller, state } = setup(payments)
    const node = FinalizeAction({ state, controller })
    const button = find(node, props => typeof props.onClick === "function")
    expect(button?.disabled).toBe(disabled)
    expect(renderToStaticMarkup(node)).toContain("Finalizar venda — R$")
  })
})
