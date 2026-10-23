import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it } from "vitest"
import { createCheckoutServices } from "@/lib/checkout/factory"
import { errorResponse } from "@/lib/checkout/errors"
import { db, owner, productSale, sale, setupCheckout } from "../setup/checkout"
import type { CheckoutClient } from "@/lib/checkout/client"

beforeEach(setupCheckout)

describe("Checkout: apresentação de constraint depois do rollback", () => {
  it.each(["create", "finalize", "cancel"] as const)("%s propaga UnknownRequestError até o rollback e só então apresenta 409", async operation => {
    const fault = new Prisma.PrismaClientUnknownRequestError('Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23514", message: "SECRET SQL constraint table column", severity: "ERROR", detail: None, column: None, hint: None }), transient: false })', { clientVersion: "6.6.0" })
    const state = { stock: operation === "cancel" ? 1 : 2, status: operation === "cancel" ? "PAID" : "PENDING", version: operation === "cancel" ? 1 : 0, actors: 0, sales: operation === "create" ? 0 : 1, items: operation === "create" ? 0 : 2, payments: operation === "cancel" ? 1 : 0, stockEntries: 0, commissionEntries: 0, commissionStatus: "POSTED", cashEntries: 0 }
    const before = structuredClone(state)
    let writesObserved = 0, rolledBack = false, callbackError: unknown
    db.$transaction.mockImplementation(async (...args: unknown[]) => {
      const original = structuredClone(state)
      try { return await (args[0] as (tx: Prisma.TransactionClient) => Promise<unknown>)(db as unknown as Prisma.TransactionClient) }
      catch (error) { callbackError = error; Object.assign(state, original); rolledBack = true; throw error }
    })
    db.checkoutActor.create.mockImplementation(async () => { state.actors++; writesObserved++; return { id: "actor" } })
    db.sale.create.mockImplementation(async () => { state.sales++; writesObserved++; return { id: "sale" } })
    db.saleItem.create.mockImplementation(async () => { state.items++; writesObserved++; return { id: "item" } })
    db.inventoryBalance.updateMany.mockImplementation(async () => { state.stock += operation === "cancel" ? 1 : -1; writesObserved++; return { count: 1 } })
    db.inventoryMovement.createMany.mockImplementation(async () => { state.stockEntries++; writesObserved++; return { count: 1 } })
    db.inventoryMovement.create.mockImplementation(async () => { state.stockEntries++; writesObserved++; return { id: "reversal" } })
    db.payment.create.mockImplementation(async () => { state.payments++; writesObserved++; return { id: "payment" } })
    db.cashMovement.create.mockImplementation(async () => { state.cashEntries++; writesObserved++; return { id: "cash-entry" } })
    db.sale.updateMany.mockImplementation(async () => { state.status = "PAID"; state.version++; writesObserved++; return { count: 1 } })
    db.sale.update.mockImplementation(async () => { state.status = "CANCELED"; state.version++; writesObserved++; return { id: "sale" } })
    db.commissionEntry.create.mockImplementation(async () => { state.commissionEntries++; writesObserved++; return { id: "reversal" } })
    db.commissionEntry.update.mockImplementation(async () => { state.commissionStatus = "REVERSED"; writesObserved++; return { id: "earned" } })

    const row = productSale()
    row.saleItem_sale.push({ ...sale().saleItem_sale[0], id: "service-item" })
    row.servicesSubtotalCents = 1000; row.totalCents = 2000
    if (operation === "cancel") {
      row.status = "PAID"; row.finalizedAt = new Date(); row.cashSessionId = "cash"; row.version = 1
      row.payment_sale = [{ id: "payment", method: "CASH", status: "RECORDED", appliedCents: 2000, cashReceivedCents: 2000, changeCents: 0, refundedCents: 0, recordedAt: new Date(), refundedAt: null }]
      db.inventoryMovement.findMany.mockResolvedValue([{ id: "out", productId: "product", saleItemId: "item", quantityDelta: -1 }])
      db.commissionEntry.findMany.mockResolvedValue([{ id: "earned", componentId: "component", professionalId: "pro", status: "POSTED", baseCents: 1000, basisPoints: 4000, amountCents: 400 }])
      db.cashMovement.findMany.mockResolvedValue([{ id: "received", paymentId: "payment", amountCents: 2000 }])
      db.payment.update.mockRejectedValue(fault)
    } else if (operation === "finalize") db.commissionEntry.createMany.mockRejectedValue(fault)
    else db.saleServiceComponent.createMany.mockRejectedValue(fault)
    db.sale.findFirst.mockResolvedValue(row)

    const services = createCheckoutServices(db as unknown as CheckoutClient)
    let error: unknown
    try {
      if (operation === "create") await services.createSale(owner, "key", { items: [{ kind: "SERVICE", catalogId: "service", professionalId: "pro", quantity: 1 }], tips: [] })
      if (operation === "finalize") await services.finalizeSale(owner, "key", "sale", { cashSessionId: "cash", expectedVersion: 0, payments: [{ method: "CASH", appliedCents: 2000, cashReceivedCents: 2000, confirmed: true }] })
      if (operation === "cancel") await services.cancelSale(owner, "key", "sale", { cashSessionId: "cash", reason: "Cancelamento" })
    } catch (caught) { error = caught }
    expect(callbackError).toBe(fault)
    expect(error).toBe(fault)
    expect(rolledBack).toBe(true)
    expect(writesObserved).toBeGreaterThan(operation === "create" ? 2 : 4)
    expect(state).toEqual(before)
    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(db.checkoutAuditEvent.create).not.toHaveBeenCalled()
    expect(db.checkoutIdempotency.create).not.toHaveBeenCalled()
    const response = errorResponse(error)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ message: "A operação conflita com o estado atual dos dados." })
  })
})
