import { readFileSync } from "node:fs"
import { PrismaClient, type Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, knownError, owner, productSale, setupCheckout } from "../setup/checkout"
import type { CheckoutClient, CheckoutDatabase } from "@/lib/checkout/client"

// If the factory or any transitive dependency imports the singleton, collection fails.
vi.mock("@/lib/prisma", () => { throw new Error("Factory reached production singleton") })
import { createCheckoutServices } from "@/lib/checkout/factory"

beforeEach(setupCheckout)
const saleInput = { items: [{ kind: "SERVICE" as const, catalogId: "service", quantity: 1, professionalId: "pro" }], tips: [] }
const payInput = { cashSessionId: "cash", expectedVersion: 0, payments: [{ method: "PIX" as const, appliedCents: 1000, confirmed: true as const }] }
function root() {
  const transaction = vi.fn(async (work: (tx: CheckoutDatabase) => Promise<unknown>) => work(db as unknown as CheckoutDatabase))
  const client = new Proxy({ $transaction: transaction }, { get(target, key) { if (key === "$transaction") return target.$transaction; throw new Error(`Escaped callback tx: ${String(key)}`) } })
  return { transaction, services: createCheckoutServices(client as unknown as CheckoutClient) }
}

describe("Checkout: injeção sem singleton", () => {
  it("construtor mantém a URL explícita sem conectar nem recorrer ao ambiente", async () => {
    const url = "postgresql://runtime:disabled@127.0.0.1:1/explicit_override_only"
    expect(url).not.toBe(process.env.DATABASE_URL)
    const client = new PrismaClient({ datasources: { db: { url } }, log: [] })
    try {
      const config = Reflect.get(client, "_engineConfig") as { overrideDatasources: { db: { url: string } } }
      expect(config.overrideDatasources.db.url).toBe(url)
    } finally { await client.$disconnect() }
  })
  it("lê caixa pelo cliente explicitamente fornecido", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "injected-cash" })
    const services = createCheckoutServices({ cashSession: { findFirst } } as unknown as CheckoutClient)
    expect(await services.currentCash(owner, "register")).toEqual({ status: 200, body: { session: { id: "injected-cash" } } })
    expect(findFirst).toHaveBeenCalledOnce()
    expect(db.cashSession.findFirst).not.toHaveBeenCalled()
  })
  it.each(["open", "move", "close", "create", "finalize", "cancel"] as const)("%s usa apenas o tx recebido do cliente injetado", async operation => {
    const { services, transaction } = root()
    if (operation === "open") { db.cashSession.findFirst.mockResolvedValue(null); await services.openCash(owner, "key", { cashRegisterId: "register", shift: "Manhã", openingBalanceCents: 0 }) }
    if (operation === "move") await services.moveCash(owner, "key", { cashSessionId: "cash", kind: "SUPPLY", amountCents: 1, reason: "Teste" })
    if (operation === "close") await services.closeCash(owner, "key", "cash", { countedBalanceCents: 5000 })
    if (operation === "create") await services.createSale(owner, "key", saleInput)
    if (operation === "finalize") await services.finalizeSale(owner, "key", "sale", payInput)
    if (operation === "cancel") await services.cancelSale(owner, "key", "sale", { reason: "Teste" })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.checkoutAuditEvent.create).toHaveBeenCalledOnce()
  })
  it("aceita TransactionClient sem transação aninhada e deixa rollback ao chamador", async () => {
    const tx: Prisma.TransactionClient = new Proxy(db, { get(target, key) { return key === "$transaction" ? undefined : Reflect.get(target, key) } }) as unknown as Prisma.TransactionClient
    const services = createCheckoutServices(tx)
    await services.createSale(owner, "key", saleInput)
    db.payment.create.mockRejectedValue(new Error("Intermediate failure"))
    await expect(services.finalizeSale(owner, "pay", "sale", payInput)).rejects.toThrow("Intermediate failure")
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.checkoutIdempotency.create).toHaveBeenCalledOnce()
  })
  it("resolve conflitos usando apenas transações do cliente injetado", async () => {
    db.sale.findFirst.mockResolvedValue(productSale())
    db.inventoryBalance.updateMany.mockRejectedValue(knownError("P2034"))
    const { services, transaction } = root()
    await expect(services.finalizeSale(owner, "key", "sale", payInput)).rejects.toMatchObject({ code: "P2034" })
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it("Prisma 6.6 carrega ambiente mas prioriza datasource explicitamente fornecido", () => {
    const generated = readFileSync("node_modules/.prisma/client/index.js", "utf8")
    const runtime = readFileSync("node_modules/@prisma/client/runtime/library.js", "utf8")
    expect(generated).toContain('"clientVersion": "6.6.0"')
    expect(generated).toContain('"schemaEnvPath": "../../../.env"')
    expect(generated).toContain("warnEnvConflicts({")
    expect(runtime).toContain('function yu(e){it(e,{conflictCheck:"warn"})}')
    expect(runtime).toContain("Fi.default.config({path:e")
    expect(runtime).toContain("a=r[o]?.url")
    expect(runtime).toContain("a?i=a:s?.value?i=s.value:s?.fromEnvVar")
  })
})
