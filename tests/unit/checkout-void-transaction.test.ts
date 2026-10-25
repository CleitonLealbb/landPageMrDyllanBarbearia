import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"
import { createCheckoutServices } from "@/lib/checkout/factory"
import type { CheckoutClient, CheckoutDatabase } from "@/lib/checkout/client"
import type { SaleView } from "@/lib/checkout/presentation"
import { knownError, owner, productSale } from "../setup/checkout"

type SavedKey = { requestHash: string; result: Prisma.JsonValue; responseStatus: number; saleId: string | null }
type KeyIdentity = { barbershopId: string; operation: string; key: string }
type Actor = { id: string; nameSnapshot: string }
type Audit = { actorId: string; action: string; entityId: string }
type StockMovement = { id: string; productId: string; saleItemId: string; kind: string; quantityDelta: number }
type PaymentData = { method: "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD"; appliedCents: number; cashReceivedCents?: number | null; changeCents: number }
type SaleChange = { status: "VOIDED" | "PAID"; version: { increment: number }; cashSessionId?: string; finalizedAt?: Date; voidedAt?: Date; voidReason?: string; voidedById?: string }
type Options = { isolationLevel: "Serializable"; maxWait: number; timeout: number }
type FaultStage = "audit" | "idempotency" | null
type StoredState = { sale: SaleView; quantity: number; stockVersion: number; movements: StockMovement[]; actors: Actor[]; audits: Audit[]; keys: Map<string, SavedKey> }
const encodedKey = ({ barbershopId, operation, key }: KeyIdentity) => JSON.stringify([barbershopId, operation, key])
const voidInput = { reason: "Cliente desistiu", expectedVersion: 0 }
const payInput = { cashSessionId: "cash", expectedVersion: 0, payments: [{ method: "PIX" as const, appliedCents: 1000, confirmed: true as const }] }

// This adapter supplies controlled commit/rollback and queues transaction callbacks.
// It exercises the real services, but does not emulate PostgreSQL locks, triggers,
// MVCC, serialization failures or durability. No database connection is made.
function controlledAdapter() {
  const state: StoredState = { sale: productSale(), quantity: 1, stockVersion: 0, movements: [], actors: [], audits: [], keys: new Map() }
  const observedWrites: { operation: string; status?: string }[] = []
  const transactions: { client: string; options: Options }[] = []
  const fault = knownError("P2004")
  let failAt: FaultStage = null
  let queue = Promise.resolve()
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: "locked" }]),
    barbershopUser: { findFirst: vi.fn(async () => ({ user: { name: "Operador" } })) },
    checkoutActor: { create: vi.fn(async ({ data }: { data: { nameSnapshot: string } }) => {
      const row = { id: `actor-${state.actors.length + 1}`, nameSnapshot: data.nameSnapshot }
      state.actors.push(row); observedWrites.push({ operation: "actor.create" }); return row
    }) },
    checkoutIdempotency: {
      findUnique: vi.fn(async ({ where }: { where: { barbershopId_operation_key: KeyIdentity } }) => structuredClone(state.keys.get(encodedKey(where.barbershopId_operation_key)) ?? null)),
      create: vi.fn(async ({ data }: { data: KeyIdentity & { requestHash: string; responseStatus: number; result: Prisma.InputJsonObject; saleId: string | null } }) => {
        observedWrites.push({ operation: "idempotency.create" })
        if (failAt === "idempotency") throw fault
        state.keys.set(encodedKey(data), { requestHash: data.requestHash, responseStatus: data.responseStatus, result: JSON.parse(JSON.stringify(data.result)) as Prisma.JsonValue, saleId: data.saleId })
        return { id: "saved-key" }
      }),
    },
    checkoutAuditEvent: { create: vi.fn(async ({ data }: { data: Audit }) => {
      observedWrites.push({ operation: "audit.create" })
      if (failAt === "audit") throw fault
      state.audits.push(structuredClone(data)); return { id: "audit" }
    }) },
    sale: {
      findFirst: vi.fn(async () => structuredClone(state.sale)),
      findFirstOrThrow: vi.fn(async () => structuredClone(state.sale)),
      updateMany: vi.fn(async ({ where, data }: { where: { barbershopId: string; id: string; status: string; finalizedAt: null; version: number }; data: SaleChange }) => {
        if (where.barbershopId !== "shop" || where.id !== state.sale.id || where.status !== state.sale.status || where.finalizedAt !== state.sale.finalizedAt || where.version !== state.sale.version) return { count: 0 }
        state.sale.status = data.status; state.sale.version += data.version.increment
        if (data.finalizedAt) state.sale.finalizedAt = data.finalizedAt
        if (data.cashSessionId) state.sale.cashSessionId = data.cashSessionId
        if (data.voidedAt) state.sale.voidedAt = data.voidedAt
        if (data.voidReason) state.sale.voidReason = data.voidReason
        if (data.voidedById) state.sale.voidedBy = { nameSnapshot: state.actors.find(row => row.id === data.voidedById)!.nameSnapshot }
        observedWrites.push({ operation: "sale.updateMany", status: data.status }); return { count: 1 }
      }),
    },
    cashSession: { findFirst: vi.fn(async () => ({ id: "cash" })) },
    cashMovement: { findMany: vi.fn(async () => []), groupBy: vi.fn(async () => []) },
    commissionEntry: { findMany: vi.fn(async () => []) },
    inventoryMovement: {
      findMany: vi.fn(async () => structuredClone(state.movements)),
      createMany: vi.fn(async ({ data }: { data: Omit<StockMovement, "id">[] }) => {
        state.movements.push(...data.map((row, index) => ({ ...row, id: `stock-${index + 1}` })))
        observedWrites.push({ operation: "inventoryMovement.createMany" }); return { count: data.length }
      }),
    },
    inventoryBalance: { updateMany: vi.fn(async ({ where, data }: { where: { barbershopId: string; productId: string; quantity: { gte: number } }; data: { quantity: { decrement: number }; version: { increment: number } } }) => {
      if (where.barbershopId !== "shop" || where.productId !== "product" || state.quantity < where.quantity.gte) return { count: 0 }
      state.quantity -= data.quantity.decrement; state.stockVersion += data.version.increment
      observedWrites.push({ operation: "inventoryBalance.updateMany" }); return { count: 1 }
    }) },
    payment: { create: vi.fn(async ({ data }: { data: PaymentData }) => {
      const id = `payment-${state.sale.payment_sale.length + 1}`
      state.sale.payment_sale.push({ id, method: data.method, status: "RECORDED", appliedCents: data.appliedCents, cashReceivedCents: data.cashReceivedCents ?? null, changeCents: data.changeCents, refundedCents: 0, recordedAt: new Date(), refundedAt: null })
      observedWrites.push({ operation: "payment.create" }); return { id }
    }) },
  }
  function client(label: string): CheckoutClient {
    const transaction = vi.fn(async (work: (database: CheckoutDatabase) => Promise<unknown>, options: Options) => {
      transactions.push({ client: label, options })
      const preceding = queue
      let release!: () => void
      queue = new Promise<void>(resolve => { release = resolve })
      await preceding
      const original = structuredClone(state)
      try { return await work(tx as unknown as CheckoutDatabase) }
      catch (error) { Object.assign(state, original); throw error }
      finally { release() }
    })
    return new Proxy({ $transaction: transaction }, { get(target, property) {
      if (property === "$transaction") return target.$transaction
      throw new Error(`Service escaped injected transaction: ${String(property)}`)
    } }) as unknown as CheckoutClient
  }
  return { state, observedWrites, transactions, tx, fault, client, injectFault: (stage: FaultStage) => { failAt = stage } }
}

describe("Checkout: idempotência e rollback com adaptador controlado, sem PostgreSQL", () => {
  it("replay da mesma chave devolve o resultado original sem novas escritas", async () => {
    const adapter = controlledAdapter(), services = createCheckoutServices(adapter.client("owner"))
    const first = await services.voidSale(owner, "void-key", "sale", voidInput)
    const original = structuredClone(adapter.state), writes = adapter.observedWrites.length
    const replay = await services.voidSale(owner, "void-key", "sale", voidInput)
    expect(replay).toEqual(first); expect(adapter.state).toEqual(original)
    expect(adapter.observedWrites).toHaveLength(writes)
    expect(adapter.tx.sale.updateMany).toHaveBeenCalledOnce()
    expect(adapter.state.actors).toHaveLength(1); expect(adapter.state.audits).toHaveLength(1); expect(adapter.state.keys.size).toBe(1)
    expect(adapter.state.sale.status).toBe("VOIDED")
  })
  it("chave diferente após descarte retorna 409 e não deixa outro autor ou auditoria", async () => {
    const adapter = controlledAdapter(), services = createCheckoutServices(adapter.client("owner"))
    await services.voidSale(owner, "void-key", "sale", voidInput)
    const original = structuredClone(adapter.state)
    await expect(services.voidSale(owner, "another-key", "sale", voidInput)).rejects.toMatchObject({ status: 409 })
    expect(adapter.state).toEqual(original)
  })
  it("mesma chave com outro motivo ou versão retorna 409, sem alterar o resultado salvo", async () => {
    const adapter = controlledAdapter(), services = createCheckoutServices(adapter.client("owner"))
    await services.voidSale(owner, "void-key", "sale", voidInput)
    const original = structuredClone(adapter.state), writes = adapter.observedWrites.length
    await expect(services.voidSale(owner, "void-key", "sale", { ...voidInput, reason: "Outro motivo" })).rejects.toMatchObject({ status: 409 })
    await expect(services.voidSale(owner, "void-key", "sale", { ...voidInput, expectedVersion: 1 })).rejects.toMatchObject({ status: 409 })
    expect(adapter.state).toEqual(original); expect(adapter.observedWrites).toHaveLength(writes)
  })
  it("replay antigo sale.cancel CANCELED sem finalização preserva JSON byte a byte", async () => {
    const adapter = controlledAdapter(), services = createCheckoutServices(adapter.client("owner"))
    adapter.state.sale.status = "CANCELED"; adapter.state.sale.canceledAt = new Date("2026-10-22T12:30:00Z")
    adapter.state.sale.cancellationReason = "Legado"
    // A fixed legacy request in the canonical property's order, not a new domain implementation.
    const requestHash = createHash("sha256").update(JSON.stringify({ operation: "sale.cancel", payload: { id: "sale", reason: "Legado" }, principal: "USER:owner" })).digest("hex")
    const legacy = { id: "sale", status: "CANCELED", finalizedAt: null, canceledAt: "2026-10-22T12:30:00.000Z", cancellationReason: "Legado", oldResponseField: "preserved", items: [{ nameSnapshot: "Produto histórico", totalCents: 1000 }] }
    const before = JSON.stringify(legacy)
    adapter.state.keys.set(encodedKey({ barbershopId: "shop", operation: "sale.cancel", key: "legacy-key" }), { requestHash, result: legacy, responseStatus: 200, saleId: "sale" })
    const original = structuredClone(adapter.state)
    const result = await services.cancelSale(owner, "legacy-key", "sale", { reason: "Legado" })
    expect(result.status).toBe(200); expect(JSON.stringify(result.body)).toBe(before)
    expect(result.body).not.toHaveProperty("closureKind"); expect(result.body).not.toHaveProperty("voidedAt")
    expect(adapter.state).toEqual(original); expect(adapter.observedWrites).toEqual([])
    expect(adapter.tx.sale.updateMany).not.toHaveBeenCalled()
  })
  it.each(["audit", "idempotency"] as const)("falha em %s após VOIDED restaura o snapshot completo no adaptador controlado", async stage => {
    const adapter = controlledAdapter(), services = createCheckoutServices(adapter.client("owner")), original = structuredClone(adapter.state)
    adapter.injectFault(stage)
    await expect(services.voidSale(owner, "void-key", "sale", voidInput)).rejects.toBe(adapter.fault)
    expect(adapter.observedWrites).toContainEqual({ operation: "sale.updateMany", status: "VOIDED" })
    expect(adapter.observedWrites).toContainEqual({ operation: `${stage}.create` })
    expect(adapter.state).toEqual(original)
    expect(adapter.state.sale.status).toBe("PENDING"); expect(adapter.state.quantity).toBe(1)
    expect(adapter.state.sale.payment_sale).toEqual([]); expect(adapter.state.movements).toEqual([])
    expect(adapter.state.actors).toEqual([]); expect(adapter.state.audits).toEqual([]); expect(adapter.state.keys.size).toBe(0)
    // The failed transaction did not reserve its key: the same request can succeed later.
    adapter.injectFault(null)
    await expect(services.voidSale(owner, "void-key", "sale", voidInput)).resolves.toMatchObject({ status: 200, body: { status: "VOIDED" } })
    expect(adapter.state.audits).toHaveLength(1); expect(adapter.state.keys.size).toBe(1)
  })
})

describe("Checkout: disputa finalizar/descartar com fila Serializable de adaptador controlado", () => {
  it.each(["void", "finalize"] as const)("%s primeiro: dois clientes injetados, um vencedor e um 409 sem efeitos parciais", async first => {
    const adapter = controlledAdapter()
    const clientA = adapter.client("operator-a"), clientB = adapter.client("operator-b")
    expect(Object.is(clientA, clientB)).toBe(false)
    const a = createCheckoutServices(clientA), b = createCheckoutServices(clientB)
    const attempts = first === "void"
      ? [a.voidSale(owner, "void-a", "sale", voidInput), b.finalizeSale(owner, "pay-b", "sale", payInput)]
      : [a.finalizeSale(owner, "pay-a", "sale", payInput), b.voidSale(owner, "void-b", "sale", voidInput)]
    const [winner, loser] = await Promise.allSettled(attempts)
    expect(winner).toMatchObject({ status: "fulfilled", value: { status: 200, body: { status: first === "void" ? "VOIDED" : "PAID" } } })
    expect(loser).toMatchObject({ status: "rejected", reason: { status: 409 } })
    expect(adapter.transactions).toEqual([
      { client: "operator-a", options: { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 } },
      { client: "operator-b", options: { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 } },
    ])
    expect(adapter.state.sale.version).toBe(1)
    expect(adapter.state.actors).toHaveLength(1); expect(adapter.state.audits).toHaveLength(1); expect(adapter.state.keys.size).toBe(1)
    expect(adapter.state.audits[0].action).toBe(first === "void" ? "sale.void" : "sale.finalize")
    expect(adapter.tx.sale.updateMany).toHaveBeenCalledOnce()
    if (first === "void") {
      expect(adapter.state.sale.status).toBe("VOIDED"); expect(adapter.state.sale.finalizedAt).toBeNull()
      expect(adapter.state.quantity).toBe(1); expect(adapter.state.stockVersion).toBe(0)
      expect(adapter.state.sale.payment_sale).toEqual([]); expect(adapter.state.movements).toEqual([])
    } else {
      expect(adapter.state.sale.status).toBe("PAID"); expect(adapter.state.sale.finalizedAt).toBeInstanceOf(Date)
      expect(adapter.state.sale.voidedAt).toBeNull(); expect(adapter.state.sale.voidReason).toBeNull()
      expect(adapter.state.quantity).toBe(0); expect(adapter.state.stockVersion).toBe(1)
      expect(adapter.state.movements).toEqual([expect.objectContaining({ productId: "product", saleItemId: "item", kind: "SALE", quantityDelta: -1 })])
      expect(adapter.state.sale.payment_sale).toEqual([expect.objectContaining({ method: "PIX", appliedCents: 1000, status: "RECORDED", refundedCents: 0 })])
    }
  })
})
