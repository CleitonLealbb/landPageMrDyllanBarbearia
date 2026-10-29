import { describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"
import { createCheckoutServices } from "@/lib/checkout/factory"
import type { CheckoutClient, CheckoutDatabase } from "@/lib/checkout/client"
import { owner } from "../setup/checkout"

type Register = { id: string; name: string; active: boolean; barbershopId: string }
type Replay = { requestHash: string; responseStatus: number; result: Prisma.JsonValue; saleId: string | null; operation: string; key: string }
// Controlled transaction adapter: proves transaction ownership, rollback and command
// ordering. Does not emulate PostgreSQL MVCC/deadlocks or replace a real DB test.
function fixture() {
  let state: { register: Register | null; sessions: { id: string }[]; movements: unknown[]; audits: unknown[]; actors: number; replays: Replay[] } = { register: { id: "register", name: "Recepção", active: true, barbershopId: "shop" }, sessions: [], movements: [], audits: [], actors: 0, replays: [] }
  let failAudit = false, failReplay = false, queue = Promise.resolve()
  const tx = {
    barbershopUser: { findFirst: async () => ({ user: { name: "Operador" } }) },
    checkoutActor: { create: async () => ({ id: `actor-${++state.actors}` }) },
    checkoutAuditEvent: { create: async ({ data }: { data: unknown }) => { if (failAudit) throw new Error("audit unavailable"); state.audits.push(data); return { id: "audit" } } },
    checkoutIdempotency: {
      findUnique: async ({ where }: { where: { barbershopId_operation_key: { operation: string; key: string } } }) => state.replays.find(row => row.operation === where.barbershopId_operation_key.operation && row.key === where.barbershopId_operation_key.key) ?? null,
      create: async ({ data }: { data: Replay }) => { if (failReplay) throw new Error("idempotency unavailable"); state.replays.push(data); return data },
    },
    $queryRaw: vi.fn(async (query: Prisma.Sql) => state.register && query.values[0] === state.register.barbershopId && query.values[1] === state.register.id ? [{ id: state.register.id }] : []),
    cashRegister: {
      findFirst: async () => state.register ? { id: state.register.id, name: state.register.name, active: state.register.active } : null,
      create: async ({ data }: { data: Omit<Register, "id"> }) => { state.register = { id: "register", ...data }; return { id: "register", name: data.name, active: data.active } },
      update: async ({ data }: { data: Partial<Pick<Register, "name" | "active">> }) => { if (!state.register) throw new Error("missing"); Object.assign(state.register, data); return { id: state.register.id, name: state.register.name, active: state.register.active } },
    },
    cashSession: {
      findFirst: async () => state.sessions[0] ?? null,
      create: async () => { const session = { id: "cash" }; state.sessions.push(session); return session },
    },
    cashMovement: { create: async ({ data }: { data: unknown }) => { state.movements.push(data); return { id: "movement" } } },
  }
  const transaction = vi.fn(async (work: (tx: CheckoutDatabase) => Promise<unknown>) => {
    const previous = queue
    let release!: () => void
    queue = new Promise<void>(done => { release = done })
    await previous
    const before = structuredClone(state)
    try { return await work(tx as unknown as CheckoutDatabase) }
    catch (error) { state = before; throw error }
    finally { release() }
  })
  const client = new Proxy({ $transaction: transaction }, { get(target, prop) { if (prop === "$transaction") return target.$transaction; throw new Error(`Root client access prohibited: ${String(prop)}`) } }) as unknown as CheckoutClient
  return { services: createCheckoutServices(client), tx, transaction, snapshot: () => structuredClone(state), failAudit: () => { failAudit = true }, failReplay: () => { failReplay = true } }
}
describe("Administração de caixas: transações injetadas e concorrência controlada", () => {
  it.each(["create", "update"] as const)("falha na auditoria reverte %s e ator integralmente", async action => {
    const f = fixture(), before = f.snapshot(); f.failAudit()
    await expect(action === "create" ? f.services.createRegister(owner, "new", { name: "Novo" }) : f.services.updateRegister(owner, "rename", "register", { name: "Novo" })).rejects.toThrow("audit unavailable")
    expect(f.snapshot()).toEqual(before)
  })
  it("falha após auditoria reverte cadastro, ator, auditoria e idempotência", async () => {
    const f = fixture(), before = f.snapshot(); f.failReplay()
    await expect(f.services.updateRegister(owner, "deactivate", "register", { active: false })).rejects.toThrow("idempotency unavailable")
    expect(f.snapshot()).toEqual(before)
  })
  it("replay preserva resultado e não repete alteração, ator ou evento", async () => {
    const f = fixture()
    const first = await f.services.updateRegister(owner, "once", "register", { name: "Balcão" }), before = f.snapshot()
    expect(await f.services.updateRegister(owner, "once", "register", { name: "Balcão" })).toEqual(first)
    expect(f.snapshot()).toEqual(before)
    await expect(f.services.updateRegister(owner, "once", "register", { name: "Outro" })).rejects.toMatchObject({ status: 409 })
    expect(f.snapshot()).toEqual(before)
  })
  it("inativação vencedora impede abertura concorrente, sem efeitos financeiros", async () => {
    const f = fixture()
    const results = await Promise.allSettled([f.services.updateRegister(owner, "off", "register", { active: false }), f.services.openCash(owner, "open", { cashRegisterId: "register", shift: "Manhã", openingBalanceCents: 0 })])
    expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected"])
    expect(results[1]).toMatchObject({ reason: { status: 409 } })
    expect(f.snapshot()).toMatchObject({ register: { active: false }, sessions: [], movements: [], actors: 1 })
  })
  it("abertura vencedora impede inativação concorrente e preserva sessão", async () => {
    const f = fixture()
    const results = await Promise.allSettled([f.services.openCash(owner, "open", { cashRegisterId: "register", shift: "Manhã", openingBalanceCents: 0 }), f.services.updateRegister(owner, "off", "register", { active: false })])
    expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected"])
    expect(results[1]).toMatchObject({ reason: { status: 409 } })
    expect(f.snapshot().register?.active).toBe(true); expect(f.snapshot().sessions).toHaveLength(1); expect(f.snapshot().movements).toHaveLength(1)
    const queries = f.tx.$queryRaw.mock.calls.map(([query]) => query.strings.join(""))
    expect(queries.every(query => query.includes('"CashRegister"') && query.includes("FOR UPDATE"))).toBe(true)
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 })
  })
  it("renomeação e inativação concorrentes preservam ambos os campos e histórico", async () => {
    const f = fixture()
    await Promise.all([f.services.updateRegister(owner, "rename", "register", { name: "Novo" }), f.services.updateRegister(owner, "off", "register", { active: false })])
    expect(f.snapshot()).toMatchObject({ register: { name: "Novo", active: false }, sessions: [], movements: [] })
    await f.services.updateRegister(owner, "on", "register", { active: true })
    expect(f.snapshot().register).toMatchObject({ name: "Novo", active: true })
    expect(f.snapshot().audits).toHaveLength(3)
  })
})
