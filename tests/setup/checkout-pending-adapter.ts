import type { Prisma } from "@prisma/client"
import { vi } from "vitest"
import type { CheckoutClient, CheckoutDatabase } from "@/lib/checkout/client"
import type { SaleView } from "@/lib/checkout/presentation"
import { knownError, productSale } from "./checkout"

type SavedKey = { requestHash: string; result: Prisma.JsonValue; responseStatus: number; saleId: string | null }
type KeyIdentity = { barbershopId: string; operation: string; key: string }
type Actor = { id: string; nameSnapshot: string }
type Audit = { actorId: string; action: string; entityId: string }
type StockMovement = { id: string; productId: string; saleItemId: string; kind: string; quantityDelta: number }
type PaymentData = { method: "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD"; appliedCents: number; cashReceivedCents?: number | null; changeCents: number }
type SaleChange = Partial<Pick<SaleView, "customerId" | "servicesSubtotalCents" | "productsSubtotalCents" | "discountKind" | "discountBasisPoints" | "discountCents" | "tipCents" | "totalCents">> & { status?: "VOIDED" | "PAID"; version: { increment: number }; cashSessionId?: string; finalizedAt?: Date; voidedAt?: Date; voidReason?: string; voidedById?: string }
type Options = { isolationLevel: "Serializable"; maxWait: number; timeout: number }
type FaultStage = "audit" | "idempotency" | "item" | "header" | null
type StoredState = { retired: SaleView["saleItem_sale"]; snapshotCount: number; sale: SaleView; quantity: number; stockVersion: number; movements: StockMovement[]; actors: Actor[]; audits: Audit[]; keys: Map<string, SavedKey> }
const encodedKey = ({ barbershopId, operation, key }: KeyIdentity) => JSON.stringify([barbershopId, operation, key])

// This adapter supplies controlled commit/rollback and queues transaction callbacks.
// It exercises the real services, but does not emulate PostgreSQL locks, triggers,
// MVCC, serialization failures or durability. No database connection is made.
export function pendingAdapter() {
  const state: StoredState = { retired: [], snapshotCount: 0, sale: productSale(), quantity: 1, stockVersion: 0, movements: [], actors: [], audits: [], keys: new Map() }
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
        if (failAt === "header") throw fault
        const { version, status, ...fields } = data
        Object.assign(state.sale, fields)
        if (status) state.sale.status = status
        state.sale.version += version.increment
        if (data.finalizedAt) state.sale.finalizedAt = data.finalizedAt
        if (data.cashSessionId) state.sale.cashSessionId = data.cashSessionId
        if (data.voidedAt) state.sale.voidedAt = data.voidedAt
        if (data.voidReason) state.sale.voidReason = data.voidReason
        if (data.voidedById) state.sale.voidedBy = { nameSnapshot: state.actors.find(row => row.id === data.voidedById)!.nameSnapshot }
        observedWrites.push({ operation: "sale.updateMany", status: data.status }); return { count: 1 }
      }),
    },
    saleItem: {
      updateMany: vi.fn(async () => { state.retired.push(...structuredClone(state.sale.saleItem_sale)); const count = state.sale.saleItem_sale.length; state.sale.saleItem_sale = []; observedWrites.push({ operation: "item.retire" }); return { count } }),
      create: vi.fn(async ({ data }: { data: Omit<SaleView["saleItem_sale"][number], "id" | "saleServiceComponent_saleItem"> }) => {
        if (failAt === "item") throw fault
        const id = `snapshot-${++state.snapshotCount}`
        state.sale.saleItem_sale.push({ ...data, id, saleServiceComponent_saleItem: [] }); observedWrites.push({ operation: "item.create" }); return { id }
      }),
    },
    saleServiceComponent: { createMany: vi.fn(async ({ data }: { data: (Omit<SaleView["saleItem_sale"][number]["saleServiceComponent_saleItem"][number], "id"> & { saleItemId: string })[] }) => {
      for (const row of data) state.sale.saleItem_sale.find(item => item.id === row.saleItemId)!.saleServiceComponent_saleItem.push({ ...row, id: `component-${++state.snapshotCount}` })
      return { count: data.length }
    }) },
    saleTip: {
      updateMany: vi.fn(async () => { const count = state.sale.saleTip_sale.length; state.sale.saleTip_sale = []; return { count } }),
      createMany: vi.fn(async ({ data }: { data: SaleView["saleTip_sale"] }) => { state.sale.saleTip_sale.push(...data); return { count: data.length } }),
    },
    service: { findMany: vi.fn(async () => [{ id: "service", name: "Corte", priceCents: 1000, durationMinutes: 30 }]) },
    product: { findMany: vi.fn(async () => [{ id: "product", name: "Pomada", priceCents: 1000 }]) },
    servicePackage: { findMany: vi.fn(async () => [{ id: "package", name: "Combo", priceCents: 1500, durationMinutes: 50, items: [{ service: { id: "service", name: "Corte", priceCents: 1000, durationMinutes: 30, status: "ACTIVE" } }, { service: { id: "beard", name: "Barba", priceCents: 500, durationMinutes: 20, status: "ACTIVE" } }] }]) },
    professional: { findFirst: vi.fn(async () => ({ id: "pro", name: "André" })), findMany: vi.fn(async () => [{ id: "pro", name: "André", commission: 40, services: [{ serviceId: "service" }, { serviceId: "beard" }] }]) },
    barbershopCustomer: { findFirst: vi.fn(async () => ({ id: "customer" })) },
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
    payment: { findMany: vi.fn(async () => structuredClone(state.sale.payment_sale)), create: vi.fn(async ({ data }: { data: PaymentData }) => {
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
