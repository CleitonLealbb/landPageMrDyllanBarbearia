import { randomUUID } from "node:crypto"
import type { Prisma, PrismaClient } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"
import type { Context } from "@/lib/checkout/authorization"

// Opt-in only. Supply CHECKOUT_VOID_POSTGRES_URL for an ALREADY MIGRATED local
// disposable PostgreSQL and CHECKOUT_VOID_POSTGRES_CONFIRM=LOCAL_DISPOSABLE.
// No migrations, DDL, dotenv, seed, existing-tenant writes or destructive cleanup.
// These tests commit their own uniquely prefixed fixtures for two connections.
// Financial-history triggers prohibit deletion: discard the entire local test
// database afterwards. Domain-generated UUIDs remain identifiable by the new
// tenant's CHECKOUT_VOID_TEST prefix and the prefixed idempotency keys.
// Merely collecting/skipping this file never imports Prisma or creates clients.
vi.mock("@/lib/prisma", () => { throw new Error("Runtime integration reached production singleton") })

const requested = process.env.CHECKOUT_VOID_POSTGRES_URL !== undefined || process.env.CHECKOUT_VOID_POSTGRES_CONFIRM !== undefined
const runtime = requested ? describe : describe.skip
type Services = ReturnType<typeof import("@/lib/checkout/factory").createCheckoutServices>
type Mutation = { status: number; body: unknown }
type Outcome = { ok: true; result: Mutation } | { ok: false; error: unknown }
type Operation = "finalize" | "void"
type Fixtures = { prefix: string; ctx: Context; productId: string; professionalId: string; cashSessionId: string; saleId: string }

function validatedLocalUrl(): string {
  const value = process.env.CHECKOUT_VOID_POSTGRES_URL
  if (!value || process.env.CHECKOUT_VOID_POSTGRES_CONFIRM !== "LOCAL_DISPOSABLE") throw new Error("Explicit disposable-local PostgreSQL opt-in is required")
  let url: URL
  try { url = new URL(value) } catch { throw new Error("Invalid disposable-local PostgreSQL URL") }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname)
    || !url.pathname || url.pathname === "/" || url.hash) throw new Error("Only an explicit localhost or 127.0.0.1 PostgreSQL database is allowed")
  // Disallow libpq-style host overrides and arbitrary connection options. The
  // sole optional input parameter selects the existing public Prisma schema.
  for (const [key, entry] of url.searchParams) if (key !== "schema" || entry !== "public") throw new Error("Unexpected local PostgreSQL connection parameter")
  url.searchParams.set("connection_limit", "2")
  url.searchParams.set("connect_timeout", "5")
  url.searchParams.set("pool_timeout", "5")
  return url.toString()
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(accept => { resolve = accept })
  return { promise, resolve }
}

function bounded<T>(promise: Promise<T>, milliseconds: number, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Local PostgreSQL timeout: ${stage}`)), milliseconds) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function sanitizedFailure(error: unknown, stage: string): Error {
  // Assertion values concern only these synthetic local fixtures and remain
  // useful diagnostics. Never propagate connector messages, SQL, URL or stack.
  if (error instanceof Error && error.name === "AssertionError") return error
  const name = error instanceof Error && /^[A-Za-z0-9_$]{1,80}$/.test(error.name) ? error.name : "UnknownError"
  const code = typeof error === "object" && error !== null ? Reflect.get(error, "code") as unknown : undefined
  return new Error(`Local PostgreSQL validation failed at ${stage}: ${name}${typeof code === "string" && /^P\d{4}$/.test(code) ? ` ${code}` : ""}`)
}

async function configure(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10000ms'")
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '8000ms'")
}

function dtoId(body: unknown): string {
  const id = typeof body === "object" && body !== null ? Reflect.get(body, "id") as unknown : undefined
  if (typeof id !== "string" || !id) throw new Error("The real checkout service did not return an ID")
  return id
}

async function createFixtures(client: PrismaClient, services: Services): Promise<Fixtures> {
  const prefix = `CHECKOUT_VOID_TEST_${randomUUID()}`
  const barbershopId = `${prefix}:tenant`, userId = `${prefix}:owner`, professionalId = `${prefix}:professional`
  const serviceId = `${prefix}:service`, productId = `${prefix}:product`, cashRegisterId = `${prefix}:register`
  await client.$transaction(async tx => {
    await configure(tx)
    await tx.barbershop.create({ data: { id: barbershopId, name: prefix, slug: prefix.toLowerCase().replace(/_/g, "-"), status: "ACTIVE", timezone: "America/Sao_Paulo" } })
    await tx.user.create({ data: { id: userId, name: `${prefix} owner`, email: `${prefix.toLowerCase()}@example.invalid`, password: "!disabled-runtime-fixture", role: "BARBERSHOP_OWNER" } })
    await tx.barbershopUser.create({ data: { id: `${prefix}:membership`, barbershopId, userId, role: "BARBERSHOP_OWNER" } })
    await tx.professional.create({ data: { id: professionalId, barbershopId, name: `${prefix} professional`, role: "Fixture", permissionLevel: "BARBER", commission: 40, specialties: [], status: "ACTIVE" } })
    await tx.service.create({ data: { id: serviceId, barbershopId, name: `${prefix} service`, priceCents: 1000, durationMinutes: 30, status: "ACTIVE" } })
    await tx.professionalService.create({ data: { barbershopId, professionalId, serviceId } })
    await tx.product.create({ data: { id: productId, barbershopId, name: `${prefix} product`, sku: `${prefix}:sku`, priceCents: 500, status: "ACTIVE" } })
    await tx.inventoryBalance.create({ data: { id: `${prefix}:balance`, barbershopId, productId, quantity: 2 } })
    await tx.checkoutActor.create({ data: { id: `${prefix}:stock-actor`, barbershopId, identityType: "USER", userId, nameSnapshot: `${prefix} owner`, roleSnapshot: "BARBERSHOP_OWNER" } })
    await tx.inventoryMovement.create({ data: { id: `${prefix}:stock-entry`, barbershopId, productId, actorId: `${prefix}:stock-actor`, kind: "ENTRY", quantityDelta: 2, reason: prefix } })
    await tx.cashRegister.create({ data: { id: cashRegisterId, barbershopId, name: `${prefix} register`, active: true } })
  }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 })
  console.info(`[checkout-void-postgres] Fixtures locais persistem; descartar o banco local ao terminar. Prefixo: ${prefix}`)
  const ctx: Context = { barbershopId, session: { type: "USER", userId, globalRole: null, tenantRole: "BARBERSHOP_OWNER", barbershopId, sessionVersion: 0 } }
  const cash = await services.openCash(ctx, `${prefix}:open`, { cashRegisterId, shift: prefix, openingBalanceCents: 10000 })
  const sale = await services.createSale(ctx, `${prefix}:create`, {
    items: [{ kind: "SERVICE", catalogId: serviceId, quantity: 1, professionalId }, { kind: "PRODUCT", catalogId: productId, quantity: 1 }],
    tips: [{ professionalId, amountCents: 100 }],
  })
  return { prefix, ctx, productId, professionalId, cashSessionId: dtoId(cash.body), saleId: dtoId(sale.body) }
}

function operate(operation: Operation, services: Services, fixtures: Fixtures): Promise<Mutation> {
  const { prefix, ctx, saleId, cashSessionId } = fixtures
  if (operation === "void") return services.voidSale(ctx, `${prefix}:void`, saleId, { expectedVersion: 0, reason: `${prefix} discard` })
  return services.finalizeSale(ctx, `${prefix}:finalize`, saleId, { expectedVersion: 0, cashSessionId, payments: [{ method: "CASH", appliedCents: 1600, cashReceivedCents: 2000, confirmed: true }] })
}

function observeSaleLock(tx: Prisma.TransactionClient, issued: () => void): Prisma.TransactionClient {
  return new Proxy(tx, {
    get(target, key) {
      if (key === "$queryRaw") return (...args: unknown[]) => {
        const query = args[0]
        const sql = typeof query === "object" && query !== null ? Reflect.get(query, "sql") as unknown : undefined
        const request = Reflect.apply(target.$queryRaw, target, args) as Prisma.PrismaPromise<unknown>
        if (typeof sql === "string" && /FROM "Sale"\s+WHERE/.test(sql) && /FOR UPDATE/.test(sql)) {
          // Start the actual PrismaPromise before signalling; never replace,
          // synthesize or resolve SQL results. pg_blocking_pids below separately
          // proves that PostgreSQL has received this lock request and blocked it.
          const pending = request.then(result => result)
          issued()
          return pending
        }
        return request
      }
      const member: unknown = Reflect.get(target, key)
      return typeof member === "function" ? member.bind(target) : member
    },
  })
}

function settled(operation: Promise<Mutation>): Promise<Outcome> {
  return operation.then(result => ({ ok: true, result }), error => ({ ok: false, error: error as unknown }))
}

async function proveServerBlocking(observer: PrismaClient, winnerPid: number, loserPid: number) {
  const until = Date.now() + 4000
  while (Date.now() < until) {
    // A second connection in client A's pool observes the two independent race
    // transactions. It performs no business write and acquires no business lock.
    const rows = await observer.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '2000ms'")
      return tx.$queryRaw<{ blocked: boolean }[]>`SELECT ${winnerPid}::integer = ANY(pg_blocking_pids(${loserPid}::integer)) AS "blocked"`
    }, { maxWait: 2000, timeout: 3000 })
    if (rows[0]?.blocked) return
    await new Promise<void>(resolve => setTimeout(resolve, 20))
  }
  throw new Error("The competing Sale FOR UPDATE did not demonstrably block on the winner")
}

async function assertCommittedState(client: PrismaClient, fixtures: Fixtures, winner: Operation) {
  const { ctx, prefix, saleId, productId, cashSessionId, professionalId } = fixtures
  const barbershopId = ctx.barbershopId
  const sale = await client.sale.findUniqueOrThrow({ where: { barbershopId_id: { barbershopId, id: saleId } }, include: { saleItem_sale: { include: { saleServiceComponent_saleItem: true } }, saleTip_sale: true, payment_sale: true } })
  const stock = await client.inventoryBalance.findUniqueOrThrow({ where: { barbershopId_productId: { barbershopId, productId } } })
  const movements = await client.inventoryMovement.findMany({ where: { barbershopId }, orderBy: { createdAt: "asc" } })
  const commissions = await client.commissionEntry.findMany({ where: { barbershopId } })
  const cash = await client.cashMovement.findMany({ where: { barbershopId, cashSessionId }, orderBy: { createdAt: "asc" } })
  const audits = await client.checkoutAuditEvent.findMany({ where: { barbershopId }, select: { action: true, entityId: true } })
  const idempotency = await client.checkoutIdempotency.findMany({ where: { barbershopId }, select: { operation: true, key: true } })
  const paid = winner === "finalize"
  expect(sale.status).toBe(paid ? "PAID" : "VOIDED")
  expect(sale.version).toBe(1) // Runtime MVCC no-op touches must not increment it.
  expect(sale).toMatchObject({ servicesSubtotalCents: 1000, productsSubtotalCents: 500, discountCents: 0, tipCents: 100, totalCents: 1600, canceledAt: null, canceledById: null, cancellationReason: null })
  expect(sale.saleItem_sale.map(item => ({ kind: item.kind, quantity: item.quantity, total: item.totalCents })).sort((a, b) => a.kind.localeCompare(b.kind))).toEqual([{ kind: "PRODUCT", quantity: 1, total: 500 }, { kind: "SERVICE", quantity: 1, total: 1000 }])
  expect(sale.saleItem_sale.flatMap(item => item.saleServiceComponent_saleItem)).toHaveLength(1)
  expect(sale.saleTip_sale).toEqual([expect.objectContaining({ professionalId, amountCents: 100 })])
  expect(stock.quantity).toBe(paid ? 1 : 2)
  expect(stock.version).toBe(paid ? 1 : 0)
  expect(movements.reduce((sum, movement) => sum + movement.quantityDelta, 0)).toBe(stock.quantity)
  expect(movements.filter(movement => movement.kind === "SALE")).toHaveLength(paid ? 1 : 0)
  expect(movements.filter(movement => movement.kind === "REVERSAL")).toHaveLength(0)
  expect(movements).toHaveLength(paid ? 2 : 1)
  expect(sale.payment_sale).toHaveLength(paid ? 1 : 0)
  expect(commissions).toHaveLength(paid ? 1 : 0)
  expect(cash.filter(movement => movement.saleId === saleId)).toHaveLength(paid ? 1 : 0)
  expect(cash.reduce((sum, movement) => sum + movement.amountCents, 0)).toBe(paid ? 11600 : 10000)
  expect(cash).toHaveLength(paid ? 2 : 1)
  if (paid) {
    expect(sale.finalizedAt).toBeInstanceOf(Date)
    expect(sale.cashSessionId).toBe(cashSessionId)
    expect(sale).toMatchObject({ voidedAt: null, voidedById: null, voidReason: null })
    expect(sale.payment_sale[0]).toMatchObject({ method: "CASH", status: "RECORDED", appliedCents: 1600, cashReceivedCents: 2000, changeCents: 400, refundedCents: 0, refundedAt: null })
    expect(commissions[0]).toMatchObject({ professionalId, kind: "EARNED", status: "POSTED", baseCents: 1000, basisPoints: 4000, amountCents: 400 })
    expect(movements.find(movement => movement.kind === "SALE")).toMatchObject({ productId, quantityDelta: -1 })
  } else {
    expect(sale).toMatchObject({ finalizedAt: null, cashSessionId: null, voidReason: `${prefix} discard` })
    expect(sale.voidedAt).toBeInstanceOf(Date)
    expect(typeof sale.voidedById).toBe("string")
  }
  const action = paid ? "sale.finalize" : "sale.void"
  expect(audits.map(audit => audit.action).sort()).toEqual(["cash.open", "sale.create", action].sort())
  expect(audits.filter(audit => audit.entityId === saleId)).toHaveLength(2)
  expect(idempotency.map(row => row.operation).sort()).toEqual(["cash.open", "sale.create", action].sort())
  expect(idempotency.every(row => row.key.startsWith(prefix))).toBe(true)
  expect(await client.checkoutActor.count({ where: { barbershopId } })).toBe(4)
}

async function runRace(winner: Operation) {
  // This guard runs before either dynamic runtime import or any constructor.
  // The ordinary suite remains network-blocked, including default skipped cases.
  const url = validatedLocalUrl()
  vi.restoreAllMocks()
  const [{ PrismaClient: Client }, { createCheckoutServices }, { errorResponse }] = await Promise.all([
    import("@prisma/client"), import("@/lib/checkout/factory"), import("@/lib/checkout/errors"),
  ])
  const clients: PrismaClient[] = []
  const release = deferred<void>()
  let first: Promise<Outcome> | undefined, second: Promise<Outcome> | undefined
  try {
    const makeClient = () => {
      const client = new Client({ datasources: { db: { url } }, log: [], transactionOptions: { maxWait: 5000, timeout: 20000 } })
      clients.push(client)
      const config = Reflect.get(client, "_engineConfig") as { overrideDatasources?: { db?: { url?: string } } }
      if (config.overrideDatasources?.db?.url !== url) throw new Error("Prisma did not retain the explicitly validated local URL")
      return client
    }
    const a = makeClient(), b = makeClient()
    const services = createCheckoutServices(a)
    const fixtures = await createFixtures(a, services)
    const ready = deferred<number>(), attempted = deferred<number>()
    const loser: Operation = winner === "finalize" ? "void" : "finalize"
    first = settled(a.$transaction(async tx => {
      await configure(tx)
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::integer AS "pid"`
      const result = await operate(winner, createCheckoutServices(tx), fixtures)
      ready.resolve(pid)
      // The winner has completed all real writes/audit/idempotency, but its
      // outer Serializable transaction deliberately has not committed yet.
      await bounded(release.promise, 15000, "winner gate")
      return result
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 }))
    const winnerPid = await bounded(Promise.race([ready.promise, first.then(outcome => { throw sanitizedFailure(outcome.ok ? new Error("Winner committed before overlap") : outcome.error, "winner before gate") })]), 12000, "winner readiness")
    second = settled(b.$transaction(async tx => {
      await configure(tx)
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::integer AS "pid"`
      return operate(loser, createCheckoutServices(observeSaleLock(tx, () => attempted.resolve(pid))), fixtures)
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 }))
    const loserPid = await bounded(Promise.race([attempted.promise, second.then(outcome => { throw sanitizedFailure(outcome.ok ? new Error("Loser committed without overlapping") : outcome.error, "loser before lock") })]), 6000, "competing lock issue")
    expect(winnerPid).not.toBe(loserPid)
    await proveServerBlocking(a, winnerPid, loserPid)
    release.resolve()
    const [won, lost] = await Promise.all([first, second])
    if (!won.ok) throw sanitizedFailure(won.error, "winning transaction")
    expect(won.result.status).toBe(200)
    expect(lost.ok).toBe(false)
    if (lost.ok) throw new Error("Both mutually exclusive operations committed")
    expect(errorResponse(lost.error).status).toBe(409)
    await assertCommittedState(a, fixtures, winner)
    // Winning-key replay must return the original response with no new writes;
    // retrying the losing key must conflict and leave no actor or ledger residue.
    const replay = await operate(winner, services, fixtures)
    expect(replay).toEqual(won.result)
    const retriedLoser = await settled(operate(loser, services, fixtures))
    expect(retriedLoser.ok).toBe(false)
    if (retriedLoser.ok) throw new Error("Closed sale accepted the losing operation")
    expect(errorResponse(retriedLoser.error).status).toBe(409)
    await assertCommittedState(a, fixtures, winner)
  } catch (error) {
    throw sanitizedFailure(error, `race ${winner}`)
  } finally {
    release.resolve()
    await Promise.allSettled([first, second].filter((value): value is Promise<Outcome> => value !== undefined))
    const disconnected = await Promise.allSettled(clients.map(client => bounded(client.$disconnect(), 5000, "disconnect")))
    if (disconnected.some(result => result.status === "rejected")) throw new Error("Local PostgreSQL clients did not disconnect within their timeout")
  }
}

runtime("Checkout PostgreSQL local descartável: finalizar versus descartar", () => {
  it("finalização vence, descarte concorrente retorna409 e não deixa efeitos parciais", async () => { await runRace("finalize") }, 45000)
  it("descarte vence, finalização concorrente retorna409 e não deixa efeitos parciais", async () => { await runRace("void") }, 45000)
})
