import { describe, expect, it } from "vitest"
import { amount, estimate, paymentInput } from "@/features/checkout/helpers"
import {
  formatPaymentCents,
  paymentError,
  paymentRemaining,
  paymentSummary,
  syncPaymentRemainder,
} from "@/features/checkout/payment-draft"
import type { CartLine, PaymentDraft } from "@/features/checkout/types"

function row(id: string, changes: Partial<PaymentDraft> = {}): PaymentDraft {
  return {
    id,
    method: "PIX",
    amount: "15,00",
    received: "",
    confirmed: false,
    amountMode: "AUTO",
    receivedMode: "AUTO",
    ...changes,
  }
}

describe("Checkout: valores inteiros dos pagamentos", () => {
  it.each([
    ["0", 0], ["0,01", 1], ["0.10", 10], ["0,20", 20],
    ["115", 11500], ["21474836,47", 2147483647],
  ])("interpreta %s em centavos sem arredondamento", (value, expected) => {
    expect(amount(value)).toBe(expected)
    expect(Number.isSafeInteger(amount(value))).toBe(true)
  })

  it.each(["-0,01", "0,001", "1e2", "NaN", "Infinity", "21474836,48"])("recusa valor inválido %s", value => {
    expect(() => amount(value)).toThrow()
  })

  it.each([
    [0, "0,00"], [1, "0,01"], [10, "0,10"], [11500, "115,00"],
    [2147483647, "21474836,47"],
  ])("formata %i centavos preservando o valor exato", (cents, expected) => {
    expect(formatPaymentCents(cents)).toBe(expected)
    expect(amount(formatPaymentCents(cents))).toBe(cents)
  })

  it.each([-1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, 2147483648])("não formata centavos inválidos %s", cents => {
    expect(() => formatPaymentCents(cents)).toThrow()
  })

  it("divide dez e vinte centavos sem erro de ponto flutuante", () => {
    const payments = [row("first", { amount: "0,10", confirmed: true }), row("last", { amount: "" })]
    const synced = syncPaymentRemainder(payments, 30)
    expect(synced[1].amount).toBe("0,20")
    expect(paymentSummary(synced, 30)).toMatchObject({ appliedCents: 30, remainingCents: 0, excessCents: 0 })
    expect(paymentInput(synced.map(payment => ({ ...payment, confirmed: true })), 30).map(payment => payment.appliedCents)).toEqual([10, 20])
  })
})

describe("Checkout: restante automático e edição manual", () => {
  it.each([true, false])("conta o PIX informado com confirmação %s no restante", confirmed => {
    const payments = [row("pix", { amount: "100,00", confirmed }), row("last")]
    expect(paymentRemaining(payments, 11500, "last")).toBe(1500)
    expect(paymentRemaining(payments, 11500)).toBe(0)
  })

  it("considera todas as outras parcelas, inclusive posteriores à linha consultada", () => {
    const payments = [row("first", { amount: "30,00" }), row("second", { amount: "25,00" }), row("third", { amount: "60,00" })]
    expect(paymentRemaining(payments, 11500, "second")).toBe(2500)
  })

  it("preenche apenas o último pagamento automático com o saldo restante", () => {
    const payments = [row("first", { amount: "100,00", amountMode: "MANUAL" }), row("last", { amount: "" })]
    const synced = syncPaymentRemainder(payments, 11500)
    expect(synced[0]).toBe(payments[0])
    expect(synced[1]).toMatchObject({ amount: "15,00", confirmed: false, amountMode: "AUTO" })
    expect(payments[1].amount).toBe("")
  })

  it("alterar o PIX para noventa recalcula o dinheiro automático para vinte e cinco", () => {
    const payments = [row("pix", { amount: "90,00", amountMode: "MANUAL" }), row("cash", { method: "CASH", received: "15,00" })]
    expect(syncPaymentRemainder(payments, 11500)[1]).toMatchObject({ amount: "25,00", received: "25,00", confirmed: false })
  })

  it("remover o PIX faz dinheiro aplicado e recebido automáticos cobrirem a venda", () => {
    const cash = row("cash", { method: "CASH", received: "15,00" })
    expect(syncPaymentRemainder([cash], 11500)[0]).toMatchObject({ amount: "115,00", received: "115,00" })
  })

  it("não altera um pagamento manual quando muda o valor restante", () => {
    const manual = row("cash", { method: "CASH", amountMode: "MANUAL", receivedMode: "MANUAL", received: "20,00" })
    const synced = syncPaymentRemainder([row("pix", { amount: "90,00" }), manual], 11500)
    expect(synced[1]).toBe(manual)
    expect(paymentSummary(synced, 11500).remainingCents).toBe(1000)
  })

  it("restaurar o modo AUTO volta a acompanhar o restante", () => {
    const payments = [row("pix", { amount: "90,00" }), row("last", { amount: "10,00", amountMode: "MANUAL" })]
    expect(syncPaymentRemainder(payments, 11500)[1].amount).toBe("10,00")
    expect(syncPaymentRemainder([payments[0], { ...payments[1], amountMode: "AUTO" }], 11500)[1].amount).toBe("25,00")
  })

  it.each([
    { amountMode: "MANUAL" as const, confirmed: false },
    { amountMode: "AUTO" as const, confirmed: true },
  ])("não busca uma parcela AUTO anterior quando a última está protegida: %j", protectedState => {
    const payments = [row("first", { amount: "90,00" }), row("last", protectedState)]
    const synced = syncPaymentRemainder(payments, 11500)
    expect(synced[0]).toBe(payments[0])
    expect(synced[1]).toBe(payments[1])
  })

  it("preserva o recebido manual quando o aplicado automático aumenta", () => {
    const cash = row("cash", { method: "CASH", received: "20,00", receivedMode: "MANUAL" })
    const synced = syncPaymentRemainder([cash], 11500)
    expect(synced[0]).toMatchObject({ amount: "115,00", received: "20,00", receivedMode: "MANUAL" })
    expect(paymentError(synced, 11500, "cash")).toMatch(/insuficiente/)
  })

  it("recebido automático acompanha um aplicado editado manualmente", () => {
    const cash = row("cash", { method: "CASH", amount: "10,00", amountMode: "MANUAL", received: "15,00" })
    expect(syncPaymentRemainder([cash], 11500)[0]).toMatchObject({ amount: "10,00", received: "10,00", amountMode: "MANUAL" })
  })

  it("não altera valores confirmados e só volta ao automático após desconfirmar", () => {
    const cash = row("cash", { method: "CASH", received: "20,00", confirmed: true })
    expect(syncPaymentRemainder([cash], 11500)[0]).toBe(cash)
    expect(syncPaymentRemainder([{ ...cash, confirmed: false }], 11500)[0]).toMatchObject({ amount: "115,00", received: "115,00", confirmed: false })
  })

  it.each(["", "100,", "inválido", "-1"])("não converte outra entrada incompleta ou inválida em zero: %s", value => {
    const last = row("last")
    const payments = [row("first", { amount: value }), last]
    expect(paymentRemaining(payments, 11500, "last")).toBeNull()
    expect(syncPaymentRemainder(payments, 11500)[1]).toBe(last)
    expect(paymentError(payments, 11500, "last")).toMatch(/outros pagamentos/)
  })

  it.each([-1, 0.5, Number.NaN, 2147483648])("não recalcula a partir de total oficial inválido %s", total => {
    const last = row("last")
    expect(paymentRemaining([last], total)).toBeNull()
    expect(syncPaymentRemainder([last], total)[0]).toBe(last)
    expect(paymentSummary([last], total).valid).toBe(false)
  })

  it("não produz restante negativo quando outra parcela excede a venda", () => {
    const payments = syncPaymentRemainder([row("pix", { amount: "120,00" }), row("last")], 11500)
    expect(payments[1].amount).toBe("0,00")
    expect(paymentRemaining(payments, 11500)).toBe(0)
    expect(paymentSummary(payments, 11500)).toMatchObject({ remainingCents: 0, excessCents: 500, valid: false })
  })

  it("acompanha total oficial atualizado por desconto e gorjeta sem mudar parcela confirmada", () => {
    const first = row("first", { amount: "90,00", confirmed: true })
    const payments = [first, row("last")]
    expect(syncPaymentRemainder(payments, 11500)[1].amount).toBe("25,00")
    expect(syncPaymentRemainder(payments, 10500)[1].amount).toBe("15,00")
    const withTip = syncPaymentRemainder(payments, 12000)
    expect(withTip[1].amount).toBe("30,00")
    expect(withTip[0]).toBe(first)
  })
})

describe("Checkout: conferência dos métodos e do troco", () => {
  it.each(["PIX", "CREDIT_CARD", "DEBIT_CARD"] as const)("recusa %s acima do restante com explicação sem troco", method => {
    const payments = [row("first", { amount: "100,00" }), row("last", { method, amount: "20,00" })]
    expect(paymentError(payments, 11500, "last")).toMatch(/excede.*PIX e cartões não permitem troco/)
    expect(paymentSummary(payments, 11500)).toMatchObject({ changeCents: 0, excessCents: 500, valid: false })
  })

  it.each(["PIX", "CREDIT_CARD", "DEBIT_CARD"] as const)("ignora campo recebido residual para %s e não envia troco", method => {
    const payment = row("first", { method, amount: "115,00", received: "200,00", confirmed: true })
    expect(paymentError([payment], 11500, payment.id)).toBeNull()
    expect(paymentSummary([payment], 11500).changeCents).toBe(0)
    expect(paymentInput([payment], 11500)).toEqual([{ method, appliedCents: 11500, confirmed: true }])
  })

  it("PIX cem e dinheiro recebido vinte aplicam quinze e geram cinco de troco", () => {
    const payments = [row("pix", { amount: "100,00", confirmed: true }), row("cash", { method: "CASH", received: "20,00", receivedMode: "MANUAL", confirmed: true })]
    expect(paymentError(payments, 11500, "cash")).toBeNull()
    expect(paymentSummary(payments, 11500)).toEqual({ appliedCents: 11500, confirmedCents: 11500, remainingCents: 0, excessCents: 0, changeCents: 500, valid: true })
    expect(paymentInput(payments, 11500)[1]).toEqual({ method: "CASH", appliedCents: 1500, cashReceivedCents: 2000, confirmed: true })
  })

  it("não converte dinheiro aplicado excedente em troco", () => {
    const payments = [row("pix", { amount: "100,00" }), row("cash", { method: "CASH", amount: "20,00", received: "20,00" })]
    expect(paymentError(payments, 11500, "cash")).toMatch(/excede.*somente em Dinheiro recebido/)
    expect(paymentSummary(payments, 11500)).toMatchObject({ changeCents: 0, excessCents: 500, valid: false })
  })

  it.each([
    ["inválido", /válido em Dinheiro recebido/],
    ["10,00", /insuficiente/],
  ])("recusa dinheiro recebido %s", (received, message) => {
    const cash = row("cash", { method: "CASH", received })
    expect(paymentError([cash], 1500, cash.id)).toMatch(message)
    expect(paymentSummary([cash], 1500)).toMatchObject({ changeCents: 0, valid: false })
  })

  it("separa total informado do confirmado sem mudar a regra do restante", () => {
    const payments = [row("first", { amount: "100,00", confirmed: true }), row("last")]
    expect(paymentSummary(payments, 11500)).toMatchObject({ appliedCents: 11500, confirmedCents: 10000, remainingCents: 0, valid: true })
    expect(() => paymentInput(payments, 11500)).toThrow(/Confirme/)
  })

  it("entrada inválida não torna um saldo aparentemente completo válido", () => {
    const payments = [row("first", { amount: "115,00", confirmed: true }), row("invalid", { amount: "" })]
    expect(paymentSummary(payments, 11500)).toMatchObject({ remainingCents: 0, valid: false })
    expect(() => paymentInput(payments, 11500)).toThrow()
  })

  it("falta de valor bloqueia finalização mesmo com parcelas confirmadas", () => {
    const payments = [row("first", { amount: "100,00", confirmed: true })]
    expect(paymentSummary(payments, 11500)).toMatchObject({ remainingCents: 1500, excessCents: 0 })
    expect(() => paymentInput(payments, 11500)).toThrow(/exatamente/)
  })

  it("preserva a venda gratuita sem inventar pagamento de zero", () => {
    expect(paymentSummary([], 0)).toEqual({ appliedCents: 0, confirmedCents: 0, remainingCents: 0, excessCents: 0, changeCents: 0, valid: true })
    expect(paymentInput([], 0)).toEqual([])
    expect(paymentError([row("zero", { amount: "0,00" })], 0, "zero")).toMatch(/positivo/)
  })
})

describe("Checkout: desconto percentual em centavos", () => {
  function line(priceCents: number): CartLine {
    return { key: "item", kind: "PRODUCT", catalogId: "product", name: "Produto", priceCents, quantity: 1, durationMinutes: null, assignments: [] }
  }

  it.each([
    [1, "50", 1], [3, "50", 2], [101, "12,5", 13],
    [11500, "10", 1150], [2147483647, "99,99", 2147268899],
  ])("arredonda desconto de %i centavos a %s por cento como o domínio", (subtotal, percent, expectedDiscount) => {
    const value = estimate([line(subtotal)], "PERCENT", percent, "0")
    expect(value.discountCents).toBe(expectedDiscount)
    expect(value.totalCents).toBe(subtotal - expectedDiscount)
    expect(Number.isSafeInteger(value.discountCents)).toBe(true)
  })

  it("soma gorjeta em centavos depois do desconto arredondado", () => {
    expect(estimate([line(101)], "PERCENT", "12,5", "0,10")).toEqual({ subtotal: 101, discountCents: 13, tipCents: 10, totalCents: 98 })
  })
})
