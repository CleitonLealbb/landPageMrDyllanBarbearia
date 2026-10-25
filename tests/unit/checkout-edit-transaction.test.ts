import { describe, expect, it } from "vitest"
import { createCheckoutServices } from "@/lib/checkout/factory"
import { editSaleSchema, type EditSaleInput } from "@/lib/checkout/validation"
import { pendingAdapter } from "../setup/checkout-pending-adapter"
import { owner } from "../setup/checkout"

const product = { kind: "PRODUCT" as const, catalogId: "product", quantity: 1 }
const service = { kind: "SERVICE" as const, catalogId: "service", quantity: 1, professionalId: "pro" }
const combo = { kind: "PACKAGE" as const, catalogId: "package", quantity: 1, components: [{ serviceId: "service", professionalId: "pro" }, { serviceId: "beard", professionalId: "pro" }] }
const input: EditSaleInput = { expectedVersion: 0, items: [product], tips: [] }
const payment = { cashSessionId: "cash", expectedVersion: 0, payments: [{ method: "PIX" as const, appliedCents: 1000, confirmed: true as const }] }

describe("Edição PENDING: serviços reais em transações controladas, sem PostgreSQL", () => {
  it.each([service, combo, product])("adiciona $kind preservando snapshot anterior e sem lançamentos", async item => {
    const a = pendingAdapter(), services = createCheckoutServices(a.client("injected"))
    await services.editSale(owner, "edit", "sale", { ...input, items: [product, item] })
    expect(a.state.retired).toHaveLength(1); expect(a.state.sale.saleItem_sale).toHaveLength(2)
    expect(a.state.sale.version).toBe(1); expect(a.state.sale.status).toBe("PENDING")
    expect(a.state.quantity).toBe(1); expect(a.state.movements).toEqual([]); expect(a.state.sale.payment_sale).toEqual([])
    expect(a.transactions).toEqual([{ client: "injected", options: { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 } }])
  })
  it.each([service, combo, product])("retira $kind sem excluir o snapshot antigo", async item => {
    const a = pendingAdapter(), services = createCheckoutServices(a.client("injected"))
    await services.editSale(owner, "first", "sale", { ...input, items: [item, product] })
    const before = structuredClone(a.state.sale.saleItem_sale)
    await services.editSale(owner, "remove", "sale", { ...input, expectedVersion: 1, items: [product] })
    expect(a.state.sale.saleItem_sale).toHaveLength(1); expect(a.state.sale.productsSubtotalCents).toBe(1000)
    expect(a.state.retired).toEqual(expect.arrayContaining(before)); expect(a.state.sale.servicesSubtotalCents).toBe(0)
  })
  it("troca quantidade e cliente; recalcula desconto e gorjeta sem comissão financeira", async () => {
    const a = pendingAdapter(), services = createCheckoutServices(a.client("injected"))
    await services.editSale(owner, "edit", "sale", { ...input, customerId: "customer", items: [{ ...product, quantity: 2 }], discount: { kind: "FIXED", amountCents: 200 }, tips: [{ professionalId: "pro", amountCents: 100 }] })
    expect(a.state.sale).toMatchObject({ customerId: "customer", productsSubtotalCents: 2000, discountCents: 200, tipCents: 100, totalCents: 1900 })
    expect(a.state.quantity).toBe(1); expect(a.tx.commissionEntry.findMany).toHaveBeenCalled()
  })
  it("replay idêntico não cria novos snapshots, autor ou auditoria", async () => {
    const a = pendingAdapter(), services = createCheckoutServices(a.client("injected"))
    const result = await services.editSale(owner, "same", "sale", input), before = structuredClone(a.state)
    expect(await services.editSale(owner, "same", "sale", input)).toEqual(result); expect(a.state).toEqual(before)
  })
  it("duas requisições da mesma chave compartilham um único resultado gravado", async () => {
    const a = pendingAdapter(), first = createCheckoutServices(a.client("one")), second = createCheckoutServices(a.client("two"))
    const [one, two] = await Promise.all([first.editSale(owner, "same", "sale", input), second.editSale(owner, "same", "sale", input)])
    expect(one).toEqual(two); expect(a.state.sale.version).toBe(1); expect(a.state.actors).toHaveLength(1); expect(a.state.audits).toHaveLength(1)
  })
  it("mesma chave com payload diferente retorna 409 sem mutação", async () => {
    const a = pendingAdapter(), services = createCheckoutServices(a.client("injected"))
    await services.editSale(owner, "same", "sale", input); const before = structuredClone(a.state)
    await expect(services.editSale(owner, "same", "sale", { ...input, items: [{ ...product, quantity: 2 }] })).rejects.toMatchObject({ status: 409 })
    expect(a.state).toEqual(before)
  })
  it.each(["item", "header", "audit", "idempotency"] as const)("rollback integral após falha em %s", async stage => {
    const a = pendingAdapter(), services = createCheckoutServices(a.client("injected")), before = structuredClone(a.state)
    a.injectFault(stage)
    await expect(services.editSale(owner, "fail", "sale", input)).rejects.toBe(a.fault)
    expect(a.state).toEqual(before)
    expect(a.observedWrites.some(write => write.operation === "item.retire")).toBe(true)
  })
  it.each(["edit", "finalize", "void"] as const)("apenas uma operação vence edição contra %s", async competitor => {
    const a = pendingAdapter(), first = createCheckoutServices(a.client("one")), second = createCheckoutServices(a.client("two"))
    const other = () => competitor === "edit" ? second.editSale(owner, "second", "sale", input) : competitor === "finalize" ? second.finalizeSale(owner, "second", "sale", payment) : second.voidSale(owner, "second", "sale", { expectedVersion: 0, reason: "Desistência" })
    const results = await Promise.allSettled([first.editSale(owner, "first", "sale", input), other()])
    expect(results[0].status).toBe("fulfilled"); expect(results[1]).toMatchObject({ status: "rejected", reason: { status: 409 } })
    expect(a.state.sale.version).toBe(1); expect(a.state.audits).toHaveLength(1); expect(a.state.actors).toHaveLength(1)
  })
  it.each(["finalize", "void"] as const)("edição perde sem efeitos quando %s vence", async competitor => {
    const a = pendingAdapter(), first = createCheckoutServices(a.client("one")), second = createCheckoutServices(a.client("two"))
    const winner = competitor === "finalize" ? first.finalizeSale(owner, "first", "sale", payment) : first.voidSale(owner, "first", "sale", { expectedVersion: 0, reason: "Desistência" })
    const results = await Promise.allSettled([winner, second.editSale(owner, "second", "sale", input)])
    expect(results[0].status).toBe("fulfilled"); expect(results[1]).toMatchObject({ status: "rejected", reason: { status: 409 } })
    expect(a.state.retired).toEqual([]); expect(a.state.sale.version).toBe(1)
  })
  it("finalização usa apenas itens atuais e revalida estoque após edição", async () => {
    const a = pendingAdapter(), services = createCheckoutServices(a.client("injected"))
    await services.editSale(owner, "edit", "sale", input)
    a.state.quantity = 0; const before = structuredClone(a.state)
    await expect(services.finalizeSale(owner, "pay", "sale", { ...payment, expectedVersion: 1 })).rejects.toMatchObject({ status: 409 })
    expect(a.state).toEqual(before)
    a.state.quantity = 1
    await services.finalizeSale(owner, "pay", "sale", { ...payment, expectedVersion: 1 })
    expect(a.state.movements).toHaveLength(1); expect(a.state.movements[0].saleItemId).toBe(a.state.sale.saleItem_sale[0].id)
    expect(a.state.movements[0].saleItemId).not.toBe(a.state.retired[0].id)
  })
  it("limites de componentes e beneficiários duplicados permanecem validados", () => {
    expect(editSaleSchema.safeParse({ ...input, tips: [{ professionalId: "pro", amountCents: 10 }, { professionalId: "pro", amountCents: 10 }] }).success).toBe(false)
    expect(editSaleSchema.safeParse({ ...input, items: Array.from({ length: 20 }, () => ({ ...combo, quantity: 100 })) }).success).toBe(false)
  })
})
