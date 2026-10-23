import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, knownError, owner, role, sale, setupCheckout } from "../setup/checkout"

const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: session }))

import { POST as open } from "@/app/api/checkout/cash-sessions/open/route"
import { GET as current } from "@/app/api/checkout/cash-sessions/current/route"
import { POST as close } from "@/app/api/checkout/cash-sessions/[id]/close/route"
import { POST as move } from "@/app/api/checkout/cash-movements/route"
import { POST as create } from "@/app/api/checkout/sales/route"
import { GET as read } from "@/app/api/checkout/sales/[id]/route"
import { POST as finalize } from "@/app/api/checkout/sales/[id]/finalize/route"
import { POST as cancel } from "@/app/api/checkout/sales/[id]/cancel/route"

const params = () => ({ params: Promise.resolve({ id: "sale" }) })
const cashParams = () => ({ params: Promise.resolve({ id: "cash" }) })
const creation = { items: [{ kind: "SERVICE", catalogId: "service", quantity: 1, professionalId: "pro" }] }
const payment = { cashSessionId: "cash", expectedVersion: 0, payments: [{ method: "PIX", appliedCents: 1000, confirmed: true }] }
function request(body: unknown, key: string | null = "request-key") {
  return new Request("http://test/api/checkout", { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) })
}
beforeEach(() => { setupCheckout(); session.mockResolvedValue(owner.session) })

describe("Checkout: contrato HTTP e autorização", () => {
  it("rotas sem ID ignoram o contexto vazio fornecido pelo Next", async () => {
    const response = await Reflect.apply(create, undefined, [request(creation), { params: Promise.resolve({}) }]) as Response
    expect(response.status).toBe(201)
    const query = await Reflect.apply(current, undefined, [new Request("http://test?cashRegisterId=register"), { params: Promise.resolve({}) }]) as Response
    expect(query.status).toBe(200)
  })
  it("rotas dinâmicas validam ID dentro da resposta segura", async () => {
    expect((await read(new Request("http://test"), { params: Promise.resolve({ id: "" }) })).status).toBe(400)
    expect((await cancel(request({ reason: "Desistência" }), { params: Promise.resolve({ id: "" }) })).status).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it("expõe os oito endpoints com respostas privadas", async () => {
    db.cashSession.findFirst.mockResolvedValueOnce(null)
    const responses = [await open(request({ cashRegisterId: "register", shift: "Manhã", openingBalanceCents: 0 })), await current(new Request("http://test/api/checkout/cash-sessions/current?cashRegisterId=register")), await move(request({ cashSessionId: "cash", kind: "SUPPLY", amountCents: 100, reason: "Suprimento" })), await close(request({ countedBalanceCents: 5000 }), cashParams()), await create(request(creation)), await read(new Request("http://test"), params()), await finalize(request(payment), params()), await cancel(request({ reason: "Desistência" }), params())]
    expect(responses.map(r => r.status)).toEqual([201, 200, 201, 200, 201, 200, 200, 200])
    for (const response of responses) {
      expect(response.headers.get("Cache-Control")).toBe("private, no-store")
      expect(JSON.stringify(await response.json())).not.toMatch(/password|sessionVersion|requestHash|barbershopId|operatorId/)
    }
  })
  it.each([null, { type: "USER", userId: "admin", globalRole: "SUPER_ADMIN", tenantRole: null, barbershopId: null, sessionVersion: 0 }])("bloqueia sessão sem tenant autorizado", async value => {
    session.mockResolvedValue(value)
    expect((await create(request(creation))).status).toBe(value ? 403 : 401)
    expect((await current(new Request("http://test?cashRegisterId=register"))).status).toBe(value ? 403 : 401)
    expect(db.$transaction).not.toHaveBeenCalled(); expect(db.cashSession.findFirst).not.toHaveBeenCalled()
  })
  it.each(["BARBER", "ASSISTANT"] as const)("%s não cancela nem aplica desconto", async tenantRole => {
    session.mockResolvedValue(role(tenantRole).session)
    expect((await cancel(request({ reason: "Cancelamento" }), params())).status).toBe(403)
    expect((await create(request({ ...creation, discount: { kind: "FIXED", amountCents: 1 } }))).status).toBe(403)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it("assistente vende, barbeiro vende o próprio atendimento e não opera caixa", async () => {
    session.mockResolvedValue(role("ASSISTANT").session)
    expect((await create(request(creation))).status).toBe(201)
    session.mockResolvedValue(role("BARBER").session)
    expect((await create(request(creation))).status).toBe(201)
    expect((await open(request({ cashRegisterId: "register", shift: "Manhã", openingBalanceCents: 0 }))).status).toBe(403)
    expect((await current(new Request("http://test?cashRegisterId=register"))).status).toBe(403)
  })
  it("barbeiro não finaliza ou lê operação alheia", async () => {
    session.mockResolvedValue(role("BARBER").session); db.professional.findFirst.mockResolvedValue({ id: "other-pro" })
    expect((await read(new Request("http://test"), params())).status).toBe(403)
    expect((await finalize(request(payment), params())).status).toBe(403)
    expect(db.payment.create).not.toHaveBeenCalled()
  })
  it("não permite tenant ou campos de snapshot no payload", async () => {
    expect((await create(request({ ...creation, barbershopId: "other" }))).status).toBe(400)
    expect((await create(request({ items: [{ ...creation.items[0], durationMinutesSnapshot: 1 }] }))).status).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it.each([null, "invalid key", "x".repeat(201)])("exige chave de idempotência válida: %s", async key => {
    expect((await create(request(creation, key))).status).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it("recusa JSON inválido, corpo excessivo e query ambígua", async () => {
    expect((await create(new Request("http://test", { method: "POST", headers: { "Idempotency-Key": "key" }, body: "{" }))).status).toBe(400)
    expect((await create(request({ data: "a".repeat(65537) }))).status).toBe(413)
    expect((await current(new Request("http://test?cashRegisterId=a&cashRegisterId=b"))).status).toBe(400)
    expect((await current(new Request("http://test?cashRegisterId=a&barbershopId=b"))).status).toBe(400)
  })
  it("venda e caixa de outro tenant retornam 404", async () => {
    db.sale.findFirst.mockResolvedValue(null)
    expect((await read(new Request("http://test"), params())).status).toBe(404)
    expect(db.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop", id: "sale" } }))
    db.$queryRaw.mockResolvedValue([])
    expect((await close(request({ countedBalanceCents: 0 }), cashParams())).status).toBe(404)
    const query = db.$queryRaw.mock.calls[0][0] as { values: unknown[] }
    expect(query.values).toEqual(["shop", "cash"])
  })
  it.each([900, 1100])("pagamento %i não cobre exatamente o total", async amount => {
    expect((await finalize(request({ ...payment, payments: [{ method: "PIX", appliedCents: amount, confirmed: true }] }), params())).status).toBe(400)
    expect(db.payment.create).not.toHaveBeenCalled()
  })
  it("não aceita finalização sem caixa, confirmação ou com troco eletrônico", async () => {
    expect((await finalize(request({ expectedVersion: 0, payments: payment.payments }), params())).status).toBe(400)
    expect((await finalize(request({ ...payment, payments: [{ method: "PIX", appliedCents: 1000, confirmed: false }] }), params())).status).toBe(400)
    expect((await finalize(request({ ...payment, payments: [{ method: "PIX", appliedCents: 1000, cashReceivedCents: 1100, confirmed: true }] }), params())).status).toBe(400)
    expect(db.payment.create).not.toHaveBeenCalled()
  })
  it("expõe snapshots de duração históricos no DTO sem releitura de catálogo", async () => {
    const row = sale(); row.saleItem_sale[0].durationMinutesSnapshot = 45
    db.sale.findFirst.mockResolvedValue(row)
    const response = await read(new Request("http://test"), params())
    const body = await response.json()
    expect(body.items[0].durationMinutesSnapshot).toBe(45)
    expect(body.items[0].components[0].durationMinutesSnapshot).toBe(30)
    expect(body.items[0].nameSnapshot).toBe("Corte antigo")
    expect(db.service.findMany).not.toHaveBeenCalled()
  })
})

describe("Checkout: erros seguros", () => {
  it.each([["P2002", undefined, 409], ["P2034", undefined, 409], ["P2003", undefined, 409], ["P2004", undefined, 409], ["P2028", undefined, 503], ["P2010", "23514", 409], ["P2010", "23503", 409], ["P2010", "40001", 409], ["P2010", "40P01", 409], ["P2010", "55P03", 409]] as const)("traduz %s/%s sem expor SQL", async (code, rawCode, status) => {
    db.$transaction.mockRejectedValue(knownError(code, rawCode))
    const response = await create(request(creation))
    expect(response.status).toBe(status)
    expect(JSON.stringify(await response.json())).not.toMatch(/SECRET|postgres|password|Prisma|P20|23514|40001/)
    expect(response.headers.get("Cache-Control")).toContain("no-store")
  })
  it("falha inesperada retorna apenas mensagem genérica", async () => {
    db.$transaction.mockRejectedValue(new Error("SECRET SQL"))
    const response = await create(request(creation))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ message: "Erro interno do servidor." })
  })
})
