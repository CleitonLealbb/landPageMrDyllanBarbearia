import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { CheckoutController } from "@/features/checkout/controller"
import { CheckoutHttp } from "@/features/checkout/http"
import { Receipt } from "@/features/checkout/components/receipt"
import { paymentInput } from "@/features/checkout/helpers"
import { pendingDraft } from "@/features/checkout/pending-draft"
import type { Bootstrap, Sale } from "@/features/checkout/types"

const data: Bootstrap = {
  operator: { id: "owner", name: "Operador", role: "BARBERSHOP_OWNER", professionalId: "pro", permissions: { sell: true, cash: true, cancel: true, discount: true } },
  services: [{ id: "service", name: "Corte atual", priceCents: 5000, durationMinutes: 40, category: null }, { id: "beard", name: "Barba", priceCents: 2000, durationMinutes: 20, category: null }],
  products: [{ id: "product", name: "Pomada", priceCents: 1000, availableQuantity: 10 }], packages: [], customers: [],
  professionals: [{ id: "pro", name: "André", serviceIds: ["service", "beard"] }, { id: "other", name: "Maria", serviceIds: ["service"] }],
  cashRegisters: [{ id: "cash", name: "Caixa" }], openSessions: [{ id: "session", cashRegisterId: "cash", status: "OPEN" }],
}
function original(): Sale {
  return { id: "sale", status: "PENDING", version: 3, customerId: "customer", discountKind: "NONE", discountBasisPoints: null,
    servicesSubtotalCents: 4500, productsSubtotalCents: 0, discountCents: 0, tipCents: 0, totalCents: 4500,
    createdAt: "2026-10-24T12:00:00Z", finalizedAt: null, canceledAt: null, payments: [], tips: [],
    items: [{ id: "snapshot", kind: "SERVICE", serviceId: "service", unitPriceCents: 4500, nameSnapshot: "Corte histórico", quantity: 1, totalCents: 4500, durationMinutesSnapshot: 30,
      components: [{ serviceId: "service", professionalId: "pro", professionalNameSnapshot: "André", serviceNameSnapshot: "Corte histórico", unitOrdinal: 1 }] }] }
}
async function setup() {
  let server = original(), fail = false
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    if (init?.method === "PATCH" && fail) { fail = false; throw new TypeError("network") }
    return Response.json(server)
  })
  const controller = new CheckoutController(new CheckoutHttp(fetcher), structuredClone(data))
  await controller.resume("sale"); fetcher.mockClear()
  return { controller, fetcher, server: (next: Sale) => { server = next }, failNext: () => { fail = true } }
}
function html(controller: CheckoutController) { return renderToStaticMarkup(createElement(Receipt, { state: controller.getSnapshot(), controller })) }

describe("Edição PENDING: interface e rascunho de pagamento", () => {
  it("mantém voltar e editar visível no rodapé e remove accordion/Consultar venda", async () => {
    const { controller } = await setup(), markup = html(controller)
    expect(markup).toContain("Voltar e editar comanda"); expect(markup).toContain("Adicione ou remova itens antes de finalizar.")
    expect(markup).not.toContain("Consultar venda"); expect(markup).not.toContain("Detalhes e ações da venda")
    expect(markup.indexOf("Voltar e editar comanda")).toBeGreaterThan(markup.indexOf("<footer"))
  })
  it("hidrata snapshots, sem trocar preço/duração pelo catálogo atual", async () => {
    const { controller } = await setup(); controller.beginEdit()
    expect(controller.editable()).toBe(true)
    expect(controller.getSnapshot().lines[0]).toMatchObject({ persistedId: "snapshot", name: "Corte histórico", priceCents: 4500, durationMinutes: 30, assignments: [{ professionalId: "pro" }] })
    const markup = html(controller)
    expect(markup).toContain("Salvar alterações e voltar ao pagamento"); expect(markup).toContain("Cancelar alterações")
    expect(markup).toContain("Item persistido"); expect(markup).not.toContain("Finalizar venda —")
  })
  it("adiciona serviço/produto, muda quantidade e profissional, remove item e altera cliente", async () => {
    const { controller, fetcher } = await setup(); controller.beginEdit()
    controller.add("SERVICE", "beard"); controller.add("PRODUCT", "product")
    controller.quantity(controller.getSnapshot().lines[2].key, 2)
    controller.assign("snapshot", "service", "other"); controller.remove(controller.getSnapshot().lines[1].key)
    controller.set({ customer: { id: "new-customer", name: "Outro cliente" }, discount: "5", tip: "2", tipProfessionalId: "pro" })
    await controller.create()
    const call = fetcher.mock.calls[0]
    expect(call[1]?.method).toBe("PATCH")
    expect(JSON.parse(String(call[1]?.body))).toEqual({ expectedVersion: 3, customerId: "new-customer", items: [{ kind: "SERVICE", catalogId: "service", quantity: 1, professionalId: "other" }, { kind: "PRODUCT", catalogId: "product", quantity: 2 }], discount: { kind: "FIXED", amountCents: 500 }, tips: [{ professionalId: "pro", amountCents: 200 }] })
    expect(JSON.stringify(call[1]?.body)).not.toMatch(/priceCents|totalCents|snapshot/)
  })
  it("cancelar alterações restaura versão persistida sem requisição e preserva pagamentos", async () => {
    const { controller, fetcher } = await setup(); controller.addPayment(); const payments = structuredClone(controller.getSnapshot().payments)
    controller.beginEdit(); controller.remove("snapshot"); controller.add("PRODUCT", "product"); controller.set({ customer: null, discount: "4" })
    controller.cancelEdit()
    expect(controller.getSnapshot()).toMatchObject({ editing: false, sale: { version: 3 }, customer: { id: "customer" }, discount: "" })
    expect(controller.getSnapshot().lines.map(line => line.key)).toEqual(["snapshot"])
    expect(controller.getSnapshot().payments).toEqual(payments); expect(fetcher).not.toHaveBeenCalled()
  })
  it("total novo recalcula automático e invalida confirmação até revisão", async () => {
    const { controller, server } = await setup(); controller.addPayment(); const id = controller.getSnapshot().payments[0].id
    controller.payment(id, { confirmed: true }); controller.beginEdit(); controller.add("PRODUCT", "product")
    server({ ...original(), version: 4, totalCents: 5500, productsSubtotalCents: 1000 })
    await controller.create()
    expect(controller.getSnapshot().payments[0]).toMatchObject({ amount: "55,00", confirmed: false, reviewRequired: true })
    expect(html(controller)).toContain("Revisão necessária")
    expect(() => paymentInput(controller.getSnapshot().payments, 5500)).toThrow()
    controller.payment(id, { confirmed: true })
    expect(controller.getSnapshot().payments[0]).toMatchObject({ confirmed: true, reviewRequired: false })
  })
  it("mesmo total com troca de profissional também exige reconfirmação", async () => {
    const { controller, server } = await setup(); controller.addPayment(); const id = controller.getSnapshot().payments[0].id
    controller.payment(id, { confirmed: true }); controller.beginEdit(); controller.assign("snapshot", "service", "other")
    const next = original(); next.version = 4; next.items[0].components[0].professionalId = "other"; server(next)
    await controller.create(); expect(controller.getSnapshot().payments[0].confirmed).toBe(false)
  })
  it("mesmo total com novo rateio/comissão também exige revisão", async () => {
    const { controller, server } = await setup(); controller.addPayment(); const id = controller.getSnapshot().payments[0].id
    controller.payment(id, { confirmed: true }); controller.beginEdit()
    const next = original(); next.version = 4
    Object.assign(next.items[0].components[0], { allocatedGrossCents: 4500, allocatedDiscountCents: 0, commissionBaseCents: 4500, commissionBasisPoints: 3000, commissionCents: 1350 })
    server(next); await controller.create()
    expect(controller.getSnapshot().payments[0]).toMatchObject({ confirmed: false, reviewRequired: true })
  })
  it("preserva entrada manual, mostra excesso e mantém Usar valor restante", async () => {
    const { controller, server } = await setup(); controller.addPayment(); const id = controller.getSnapshot().payments[0].id
    controller.payment(id, { amount: "40" }); controller.payment(id, { confirmed: true }); controller.beginEdit()
    server({ ...original(), version: 4, totalCents: 3000 }); await controller.create()
    expect(controller.getSnapshot().payments[0]).toMatchObject({ amount: "40", amountMode: "MANUAL", confirmed: false })
    expect(html(controller)).toContain("Valor aplicado excedente")
    controller.usePaymentRemaining(id); expect(controller.getSnapshot().payments[0].amount).toBe("30,00")
  })
  it("preserva manual válido e dinheiro recebido, recalculando só o aplicado automático", async () => {
    const { controller, server } = await setup(); controller.addPayment(); let id = controller.getSnapshot().payments[0].id
    controller.payment(id, { amount: "30" }); controller.addPayment("CASH"); id = controller.getSnapshot().payments[1].id
    controller.payment(id, { received: "20" }); controller.beginEdit(); server({ ...original(), version: 4, totalCents: 4000 })
    await controller.create()
    expect(controller.getSnapshot().payments.map(p => p.amount)).toEqual(["30", "10,00"])
    expect(controller.getSnapshot().payments[1].received).toBe("20")
    controller.getSnapshot().payments.forEach(p => controller.payment(p.id, { confirmed: true }))
    expect(paymentInput(controller.getSnapshot().payments, 4000)[1]).toMatchObject({ method: "CASH", appliedCents: 1000, cashReceivedCents: 2000 })
  })
  it("repetição incerta envia a mesma chave e payload da edição, sem criar outra venda", async () => {
    const { controller, fetcher, failNext } = await setup(); controller.beginEdit(); controller.add("PRODUCT", "product"); failNext()
    await controller.create(); expect(controller.getSnapshot().retry).toBe(true)
    await controller.retry()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][1]?.body).toEqual(fetcher.mock.calls[1][1]?.body)
    expect(fetcher.mock.calls[0][1]?.headers).toEqual(fetcher.mock.calls[1][1]?.headers)
    expect(fetcher.mock.calls.every(call => call[1]?.method === "PATCH")).toBe(true)
  })
  it("bloqueia duplo envio e finalização durante edição", async () => {
    const { controller, fetcher } = await setup(); controller.beginEdit(); await controller.finalize(); expect(fetcher).not.toHaveBeenCalled()
    await Promise.all([controller.create(), controller.create()]); expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each(["PAID", "CANCELED", "VOIDED"] as const)("%s não entra em edição", status => {
    expect(() => pendingDraft({ ...original(), status })).toThrow()
  })
  it("preserva gorjetas múltiplas e desconto percentual ao hidratar", () => {
    const draft = pendingDraft({ ...original(), discountKind: "MANUAL_PERCENT", discountBasisPoints: 1250, tips: [{ professionalId: "pro", professionalNameSnapshot: "André", amountCents: 100 }, { professionalId: "other", professionalNameSnapshot: "Maria", amountCents: 200 }] })
    expect(draft).toMatchObject({ discountKind: "PERCENT", discount: "12,50", extraTips: [{ professionalId: "other", amountCents: 200 }] })
  })
  it("adição de combo preserva profissionais por serviço no payload", async () => {
    const { controller, fetcher } = await setup()
    controller.getSnapshot().data!.packages.push({ id: "package", name: "Combo", priceCents: 6000, durationMinutes: 60, services: data.services })
    controller.beginEdit(); controller.add("PACKAGE", "package"); await controller.create()
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).items[1]).toEqual({ kind: "PACKAGE", catalogId: "package", quantity: 1, components: [{ serviceId: "service", professionalId: "pro" }, { serviceId: "beard", professionalId: "pro" }] })
  })
  it("conflito mantém rascunho até abandonar explicitamente e carregar versão atual", async () => {
    let conflict = false
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (init?.method === "PATCH") { conflict = true; return Response.json({ message: "Conflito" }, { status: 409 }) }
      return Response.json({ ...original(), ...(conflict ? { version: 4, status: "VOIDED" } : {}) })
    })
    const controller = new CheckoutController(new CheckoutHttp(fetcher), structuredClone(data))
    await controller.resume("sale"); controller.beginEdit(); controller.add("PRODUCT", "product"); await controller.create()
    expect(controller.getSnapshot()).toMatchObject({ status: 409, editing: true }); expect(controller.getSnapshot().lines).toHaveLength(2)
    await controller.reloadConflict()
    expect(controller.getSnapshot()).toMatchObject({ status: null, editing: false, sale: { status: "VOIDED", version: 4 }, lines: [] })
    expect(controller.editable()).toBe(false)
  })
  it("desconto maior que composição reduzida bloqueia salvar sem requisição", async () => {
    const { controller, fetcher } = await setup(); controller.beginEdit(); controller.set({ discount: "50" })
    await controller.create(); expect(fetcher).not.toHaveBeenCalled(); expect(controller.getSnapshot().editing).toBe(true)
  })
})
