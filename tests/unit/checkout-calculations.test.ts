import { describe, expect, it } from "vitest"
import { allocate, cashBalance, commissionPoints, discountAmount, integer, multiply, payments, percentage, positiveDuration, sum } from "@/lib/checkout/calculations"
import { createSaleSchema, finalizeSchema, movementSchema, paymentSchema } from "@/lib/checkout/validation"

describe("Checkout: cálculos inteiros e entrada", () => {
  it("arredonda meia unidade e evita imprecisão e overflow", () => {
    expect(percentage(1, 5000)).toBe(1)
    expect(percentage(2147483647, 10000)).toBe(2147483647)
    expect(sum([1, 2, 3])).toBe(6)
    expect(multiply(333, 3)).toBe(999)
    for (const n of [NaN, Infinity, 1.5, -1, 2147483648]) expect(() => integer(n)).toThrow()
    expect(() => sum([2147483647, 1])).toThrow()
    expect(commissionPoints(40)).toBe(4000)
    expect(() => commissionPoints(101)).toThrow()
  })
  it("rateia combos pelo preço original e desempata centavos por ordem estável", () => {
    expect(allocate(1001, [1000, 500])).toEqual([667, 334])
    expect(allocate(2, [1, 1, 1])).toEqual([1, 1, 0])
    expect(allocate(0, [0, 0])).toEqual([0, 0])
    expect(() => allocate(1, [0, 0])).toThrow()
    for (let total = 0; total < 100; total++) expect(sum(allocate(total, [31, 59, 2, 0]))).toBe(total)
  })
  it("calcula descontos fixo/percentual sem exceder o subtotal", () => {
    expect(discountAmount(1001, { kind: "PERCENT", basisPoints: 1000 })).toBe(100)
    expect(discountAmount(1001, { kind: "FIXED", amountCents: 200 })).toBe(200)
    expect(discountAmount(1001)).toBe(0)
    expect(() => discountAmount(10, { kind: "FIXED", amountCents: 11 })).toThrow()
  })
  it.each([null, 0, -1, 0.5])("recusa duração inválida %s", value => expect(() => positiveDuration(value)).toThrow())
  it("aceita pagamentos mistos e troco somente em dinheiro", () => {
    const rows = payments(1000, [{ method: "PIX", appliedCents: 600, confirmed: true }, { method: "CASH", appliedCents: 400, cashReceivedCents: 500, confirmed: true }])
    expect(rows[1].changeCents).toBe(100)
    expect(rows[0].cashReceivedCents).toBeNull()
    expect(payments(0, [])).toEqual([])
  })
  it.each([900, 1100])("recusa pagamento insuficiente/excedente: %i", amount => expect(() => payments(1000, [{ method: "PIX", appliedCents: amount, confirmed: true }])).toThrow())
  it("recusa troco eletrônico, dinheiro insuficiente e confirmação ausente", () => {
    expect(() => payments(1000, [{ method: "PIX", appliedCents: 1000, cashReceivedCents: 1100, confirmed: true }])).toThrow()
    expect(() => payments(1000, [{ method: "CASH", appliedCents: 1000, cashReceivedCents: 999, confirmed: true }])).toThrow()
    expect(() => paymentSchema.parse({ method: "PIX", appliedCents: 1000, confirmed: false })).toThrow()
  })
  it("reconcilia somente dinheiro no caixa", () => {
    expect(cashBalance([{ kind: "OPENING", amountCents: 1000 }, { kind: "SUPPLY", amountCents: 500 }, { kind: "SALE", amountCents: 1000 }, { kind: "WITHDRAWAL", amountCents: 200 }, { kind: "REVERSAL", amountCents: 1000 }])).toBe(1300)
    expect(() => cashBalance([{ kind: "WITHDRAWAL", amountCents: 1 }])).toThrow()
  })
  it("recusa tenant, snapshots, dinheiro decimal e vendas sem caixa na entrada", () => {
    const item = { kind: "PRODUCT", catalogId: "product", quantity: 1 }
    expect(createSaleSchema.safeParse({ items: [item], barbershopId: "other" }).success).toBe(false)
    expect(createSaleSchema.safeParse({ items: [{ ...item, unitPriceCents: 1 }] }).success).toBe(false)
    expect(finalizeSchema.safeParse({ expectedVersion: 0, payments: [] }).success).toBe(false)
    expect(movementSchema.safeParse({ cashSessionId: "cash", kind: "SUPPLY", amountCents: 1.5, reason: "Suprimento" }).success).toBe(false)
    expect(paymentSchema.safeParse({ method: "PIX", appliedCents: 0, confirmed: true }).success).toBe(false)
  })
})
