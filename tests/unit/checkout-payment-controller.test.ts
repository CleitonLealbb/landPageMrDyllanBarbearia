import { describe, expect, it, vi } from "vitest"
import { CheckoutController } from "@/features/checkout/controller"
import { CheckoutHttp } from "@/features/checkout/http"
import { amount, paymentInput } from "@/features/checkout/helpers"
import type { Bootstrap, Method, Sale } from "@/features/checkout/types"

function bootstrap(): Bootstrap {
  return {
    operator: { id: "operator", name: "Operador", role: "BARBERSHOP_OWNER", professionalId: "professional", permissions: { sell: true, cash: true, discount: true, cancel: true } },
    services: [{ id: "service", name: "Atendimento", priceCents: 11500, durationMinutes: 30, category: null }],
    packages: [], products: [], customers: [],
    professionals: [{ id: "professional", name: "Profissional", serviceIds: ["service"] }],
    cashRegisters: [{ id: "register", name: "Caixa principal" }],
    openSessions: [{ id: "session", cashRegisterId: "register", status: "OPEN" }],
  }
}

function pendingSale(totalCents = 11500): Sale {
  return {
    id: "sale", status: "PENDING", version: 1, customerId: null,
    servicesSubtotalCents: totalCents, productsSubtotalCents: 0, discountCents: 0, tipCents: 0, totalCents,
    createdAt: "2026-10-24T12:00:00Z", finalizedAt: null, canceledAt: null,
    items: [{ id: "item", kind: "SERVICE", nameSnapshot: "Atendimento", quantity: 1, totalCents, durationMinutesSnapshot: 30, components: [{ serviceNameSnapshot: "Atendimento", professionalNameSnapshot: "Profissional" }] }],
    tips: [], payments: [],
  }
}

function setup(totalCents = 11500) {
  let serverSale = pendingSale(totalCents)
  const data = bootstrap()
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    if (String(url).startsWith("/api/checkout/bootstrap")) return Response.json(data)
    if (init?.method === "POST" && String(url).endsWith("/finalize")) {
      serverSale = { ...serverSale, status: "PAID", version: serverSale.version + 1, finalizedAt: "2026-10-24T12:10:00Z" }
    }
    return Response.json(serverSale)
  })
  const controller = new CheckoutController(new CheckoutHttp(fetcher), data)
  return { controller, fetcher, server: (change: Partial<Sale>) => { serverSale = { ...serverSale, ...change } } }
}

async function open(totalCents = 11500) {
  const result = setup(totalCents)
  await result.controller.resume("sale")
  result.fetcher.mockClear()
  return result
}

function add(controller: CheckoutController, method: Method = "PIX") {
  controller.addPayment(method)
  return controller.getSnapshot().payments.at(-1)!
}

function line(controller: CheckoutController, id: string) {
  return controller.getSnapshot().payments.find(payment => payment.id === id)!
}

function pix100(controller: CheckoutController) {
  const pix = add(controller)
  controller.payment(pix.id, { amount: "100" })
  controller.payment(pix.id, { confirmed: true })
  return pix.id
}

describe("Checkout: preenchimento automático do pagamento misto", () => {
  it.each(["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH"] as const)("inicia %s com o restante em centavos e sem confirmar recebimento", async method => {
    const { controller, fetcher } = await open()
    pix100(controller)
    const payment = add(controller, method)
    expect(amount(payment.amount)).toBe(1500)
    expect(payment.amountMode).toBe("AUTO")
    expect(payment.confirmed).toBe(false)
    if (method === "CASH") {
      expect(amount(payment.received)).toBe(1500)
      expect(payment.receivedMode).toBe("AUTO")
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("usa também pagamentos ainda não confirmados para sugerir o restante, sem confirmá-los", async () => {
    const { controller } = await open()
    const pix = add(controller)
    controller.payment(pix.id, { amount: "100" })
    const cash = add(controller, "CASH")
    expect(amount(cash.amount)).toBe(1500)
    expect(controller.getSnapshot().payments.every(payment => !payment.confirmed)).toBe(true)
    controller.payment(pix.id, { confirmed: true })
    expect(amount(line(controller, cash.id).amount)).toBe(1500)
    controller.payment(pix.id, { confirmed: false })
    expect(amount(line(controller, cash.id).amount)).toBe(1500)
  })

  it("remover PIX desconfirmado restaura dinheiro automático e recebido para R$115", async () => {
    const { controller } = await open()
    const pix = pix100(controller), cash = add(controller, "CASH")
    controller.payment(pix, { confirmed: false })
    controller.removePayment(pix)
    expect(controller.getSnapshot().payments).toHaveLength(1)
    expect(amount(line(controller, cash.id).amount)).toBe(11500)
    expect(amount(line(controller, cash.id).received)).toBe(11500)
  })

  it("alterar PIX para R$90 recalcula o último dinheiro automático para R$25", async () => {
    const { controller } = await open()
    const pix = pix100(controller), cash = add(controller, "CASH")
    controller.payment(pix, { confirmed: false })
    controller.payment(pix, { amount: "90" })
    expect(amount(line(controller, cash.id).amount)).toBe(2500)
    expect(amount(line(controller, cash.id).received)).toBe(2500)
  })

  it("preserva valor manual e permite restaurar explicitamente o restante automático", async () => {
    const { controller } = await open()
    const pix = pix100(controller), cash = add(controller, "CASH")
    controller.payment(cash.id, { amount: "10" })
    expect(line(controller, cash.id).amountMode).toBe("MANUAL")
    controller.payment(pix, { confirmed: false })
    controller.payment(pix, { amount: "90" })
    expect(line(controller, cash.id).amount).toBe("10")
    controller.usePaymentRemaining(cash.id)
    expect(amount(line(controller, cash.id).amount)).toBe(2500)
    expect(line(controller, cash.id).amountMode).toBe("AUTO")
    controller.payment(pix, { amount: "95" })
    expect(amount(line(controller, cash.id).amount)).toBe(2000)
  })

  it("preserva dinheiro recebido manual após mudança no restante", async () => {
    const { controller, fetcher } = await open()
    const pix = pix100(controller), cash = add(controller, "CASH")
    controller.payment(cash.id, { received: "20" })
    controller.payment(pix, { confirmed: false })
    controller.removePayment(pix)
    expect(amount(line(controller, cash.id).amount)).toBe(11500)
    expect(line(controller, cash.id)).toMatchObject({ received: "20", receivedMode: "MANUAL" })
    controller.payment(cash.id, { confirmed: true })
    await controller.finalize()
    expect(fetcher).not.toHaveBeenCalled()
    expect(controller.getSnapshot().error).toBeTruthy()
  })

  it("nunca produz restante automático negativo quando um valor manual excede o total", async () => {
    const { controller } = await open()
    const pix = add(controller)
    controller.payment(pix.id, { amount: "120" })
    const cash = add(controller, "CASH")
    expect(amount(cash.amount)).toBe(0)
    expect(amount(cash.received)).toBe(0)
    expect(line(controller, pix.id).amount).toBe("120")
  })

  it("preserva centavos exatos sem resíduo de ponto flutuante", async () => {
    const { controller, fetcher } = await open(30)
    const pix = add(controller)
    controller.payment(pix.id, { amount: "0,10", confirmed: true })
    const debit = add(controller, "DEBIT_CARD")
    expect(amount(debit.amount)).toBe(20)
    controller.payment(debit.id, { confirmed: true })
    await controller.finalize()
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).payments).toEqual([
      { method: "PIX", appliedCents: 10, confirmed: true },
      { method: "DEBIT_CARD", appliedCents: 20, confirmed: true },
    ])
  })
})

describe("Checkout: confirmação protege entradas e o total oficial", () => {
  it("exige desconfirmar antes de editar e antes de remover um pagamento", async () => {
    const { controller } = await open()
    const pix = pix100(controller), before = line(controller, pix)
    controller.payment(pix, { amount: "90", method: "CASH", received: "95" })
    expect(line(controller, pix)).toEqual(before)
    controller.payment(pix, { confirmed: false, amount: "90" })
    expect(line(controller, pix)).toEqual(before)
    controller.removePayment(pix)
    expect(line(controller, pix)).toEqual(before)
    controller.usePaymentRemaining(pix)
    expect(line(controller, pix)).toEqual(before)
    controller.payment(pix, { confirmed: false })
    controller.payment(pix, { amount: "90" })
    expect(line(controller, pix)).toMatchObject({ amount: "90", confirmed: false })
    controller.removePayment(pix)
    expect(controller.getSnapshot().payments).toEqual([])
  })

  it("não altera o último pagamento confirmado ao editar um anterior", async () => {
    const { controller, fetcher } = await open()
    const pix = pix100(controller), cash = add(controller, "CASH")
    controller.payment(cash.id, { confirmed: true })
    const confirmed = line(controller, cash.id)
    controller.payment(pix, { confirmed: false })
    controller.payment(pix, { amount: "90", confirmed: true })
    expect(line(controller, cash.id)).toEqual(confirmed)
    await controller.finalize()
    expect(fetcher).not.toHaveBeenCalled()
    expect(controller.getSnapshot().error).toBeTruthy()
    controller.payment(cash.id, { confirmed: false })
    expect(amount(line(controller, cash.id).amount)).toBe(2500)
    expect(line(controller, cash.id).confirmed).toBe(false)
  })

  it("atualizar o total oficial recalcula somente o último automático não confirmado", async () => {
    const { controller, server } = await open()
    const pix = pix100(controller), cash = add(controller, "CASH")
    server({ discountCents: 1000, tipCents: 1500, totalCents: 12000, version: 2 })
    await controller.readSale()
    expect(amount(line(controller, cash.id).amount)).toBe(2000)
    expect(amount(line(controller, cash.id).received)).toBe(2000)
    expect(line(controller, pix)).toMatchObject({ amount: "100", confirmed: true })
  })

  it("atualização oficial preserva valor manual e pagamento confirmado", async () => {
    const { controller, server } = await open()
    pix100(controller)
    const cash = add(controller, "CASH")
    controller.payment(cash.id, { amount: "10", received: "15" })
    server({ totalCents: 12000 })
    await controller.readSale()
    expect(line(controller, cash.id)).toMatchObject({ amount: "10", received: "15", amountMode: "MANUAL", receivedMode: "MANUAL" })
    controller.usePaymentRemaining(cash.id)
    controller.payment(cash.id, { received: "20", confirmed: true })
    const confirmed = line(controller, cash.id)
    server({ totalCents: 12500 })
    await controller.readSale()
    expect(line(controller, cash.id)).toEqual(confirmed)
  })

  it("desconto e gorjeta enviados na criação não substituem o total confirmado pelo servidor", async () => {
    const { controller, fetcher, server } = setup()
    controller.add("SERVICE", "service")
    controller.set({ discount: "10", tip: "5", tipProfessionalId: "professional" })
    server({ discountCents: 1000, tipCents: 500, totalCents: 11000 })
    await controller.create()
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body))
    expect(body.discount).toEqual({ kind: "FIXED", amountCents: 1000 })
    expect(body.tips).toEqual([{ professionalId: "professional", amountCents: 500 }])
    expect(amount(add(controller).amount)).toBe(11000)
    const before = controller.getSnapshot()
    controller.set({ discount: "0", tip: "30" })
    expect(controller.getSnapshot()).toBe(before)
    expect(controller.getSnapshot().sale?.totalCents).toBe(11000)
  })
})

describe("Checkout: validação e payload do pagamento misto", () => {
  it.each(["PIX", "CREDIT_CARD", "DEBIT_CARD"] as const)("não confirma nem finaliza %s acima do restante", async method => {
    const { controller, fetcher } = await open()
    pix100(controller)
    const payment = add(controller, method)
    controller.payment(payment.id, { amount: "16" })
    controller.payment(payment.id, { confirmed: true })
    expect(line(controller, payment.id)).toMatchObject({ amount: "16", confirmed: false })
    expect(controller.getSnapshot().error).toBeTruthy()
    await controller.finalize()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("dinheiro recebido excedente mantém aplicado R$15, troco R$5 e receita R$115", async () => {
    const { controller, fetcher } = await open()
    pix100(controller)
    const cash = add(controller, "CASH")
    controller.payment(cash.id, { received: "20" })
    expect(amount(line(controller, cash.id).amount)).toBe(1500)
    expect(amount(line(controller, cash.id).received) - amount(line(controller, cash.id).amount)).toBe(500)
    controller.payment(cash.id, { confirmed: true })
    await controller.finalize()
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe("/api/checkout/sales/sale/finalize")
    expect(JSON.parse(String(options?.body))).toEqual({ cashSessionId: "session", expectedVersion: 1, payments: [
      { method: "PIX", appliedCents: 10000, confirmed: true },
      { method: "CASH", appliedCents: 1500, cashReceivedCents: 2000, confirmed: true },
    ] })
    expect(controller.getSnapshot().sale?.status).toBe("PAID")
  })

  it("valor recebido residual em PIX ou cartão não vai no payload nem gera troco", async () => {
    const { controller, fetcher } = await open()
    const pix = add(controller)
    controller.payment(pix.id, { received: "200", confirmed: true })
    const input = paymentInput(controller.getSnapshot().payments, 11500)
    expect(input).toEqual([{ method: "PIX", appliedCents: 11500, confirmed: true }])
    await controller.finalize()
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).payments).toEqual(input)
  })

  it("finalização incompleta ou não confirmada não envia requisição", async () => {
    const { controller, fetcher } = await open()
    pix100(controller)
    await controller.finalize()
    expect(fetcher).not.toHaveBeenCalled()
    const cash = add(controller, "CASH")
    await controller.finalize()
    expect(fetcher).not.toHaveBeenCalled()
    expect(line(controller, cash.id).confirmed).toBe(false)
  })

  it("bloqueia duplo envio e edições durante a finalização", async () => {
    const { controller, fetcher } = await open()
    const pix = add(controller)
    controller.payment(pix.id, { confirmed: true })
    let resolve!: (response: Response) => void
    fetcher.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done }))
    const first = controller.finalize(), before = controller.getSnapshot().payments
    await controller.finalize()
    controller.payment(pix.id, { confirmed: false })
    controller.removePayment(pix.id)
    controller.usePaymentRemaining(pix.id)
    controller.addPayment("CASH")
    expect(controller.getSnapshot().payments).toEqual(before)
    expect(fetcher).toHaveBeenCalledTimes(1)
    resolve(Response.json({ ...pendingSale(), status: "PAID" }))
    await first
  })

  it("retry preserva chave e payload sem metadados de preenchimento do frontend", async () => {
    const { controller, fetcher } = await open()
    pix100(controller)
    const cash = add(controller, "CASH")
    controller.payment(cash.id, { received: "20", confirmed: true })
    fetcher.mockRejectedValueOnce(new TypeError("network"))
    await controller.finalize()
    expect(controller.getSnapshot().retry).toBe(true)
    const before = controller.getSnapshot().payments
    controller.payment(cash.id, { confirmed: false })
    controller.usePaymentRemaining(cash.id)
    expect(controller.getSnapshot().payments).toEqual(before)
    await controller.retry()
    expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body)
    expect(fetcher.mock.calls[0][1]?.headers).toEqual(fetcher.mock.calls[1][1]?.headers)
    expect(String(fetcher.mock.calls[0][1]?.body)).not.toMatch(/amountMode|receivedMode|\bid\b|MANUAL|AUTO/)
    expect(controller.getSnapshot().sale?.status).toBe("PAID")
  })
})
