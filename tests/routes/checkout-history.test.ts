import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, owner, role, sale, setupCheckout } from "../setup/checkout"
import { createCheckoutServices } from "@/lib/checkout/factory"
import type { CheckoutClient } from "@/lib/checkout/client"
const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: session }))
import { GET as sales } from "@/app/api/checkout/sales/route"
import { GET as saleDetail } from "@/app/api/checkout/sales/[id]/route"
import { GET as sessions } from "@/app/api/checkout/cash-sessions/route"
import { GET as cashDetail } from "@/app/api/checkout/cash-sessions/[id]/route"

const at = new Date("2026-10-22T12:00:00Z")
const query = "period=custom&start=2026-10-01&end=2026-10-31"
const req = (suffix = query) => new Request(`http://test/api/checkout/history?${suffix}`)
const params = (id = "sale") => ({ params: Promise.resolve({ id }) })
function listRow(id = "sale") {
  return { id, status: "PAID", createdAt: at, finalizedAt: at, canceledAt: null, voidedAt: null, totalCents: 1000,
    customer: { id: "customer", customerAccount: { name: "Cliente histórico" } }, cashSession: { cashRegister: { name: "Caixa antigo" } },
    saleItem_sale: [{ quantity: 1, saleServiceComponent_saleItem: [{ professionalId: "pro", professionalNameSnapshot: "Profissional histórico" }] }] }
}
function cashRow() {
  return { id: "cash", status: "CLOSED", shift: "Manhã", openedAt: at, closedAt: at, openingBalanceCents: 5000, expectedBalanceCents: 5000, countedBalanceCents: 4900, differenceCents: -100,
    cashRegister: { name: "Caixa inativo" }, openedBy: { nameSnapshot: "Operador antigo" }, closedBy: { nameSnapshot: "Responsável" }, notes: "Nota do proprietário" }
}
function detailed() {
  return { ...sale({ status: "PAID", finalizedAt: at }), customer: { id: "customer", customerAccount: { name: "Cliente histórico" } }, operator: { nameSnapshot: "Operador" }, canceledBy: null, cashSession: { id: "cash", status: "CLOSED", cashRegister: { name: "Caixa antigo" } } }
}
beforeEach(() => {
  setupCheckout(); session.mockResolvedValue(owner.session)
  db.barbershop.findFirst.mockResolvedValue({ timezone: "America/Sao_Paulo" })
  db.sale.findMany.mockResolvedValue([listRow()])
  db.sale.findFirst.mockResolvedValue(detailed())
  db.cashSession.findMany.mockResolvedValue([cashRow()])
  db.cashSession.findFirst.mockResolvedValue(cashRow())
  db.cashMovement.findMany.mockResolvedValue([])
  db.checkoutAuditEvent.findMany.mockResolvedValue([])
})

describe("Históricos Checkout: endpoints e isolamento", () => {
  it.each([sales, sessions])("exige sessão para listagem", async route => {
    session.mockResolvedValue(null)
    expect((await route(req())).status).toBe(401)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it.each([saleDetail, cashDetail])("exige sessão para detalhe", async route => {
    session.mockResolvedValue(null)
    expect((await route(req(""), params())).status).toBe(401)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it.each(["BARBERSHOP_OWNER", "ASSISTANT"] as const)("%s consulta vendas e caixas privados sem escritas", async tenantRole => {
    session.mockResolvedValue({ ...owner.session, tenantRole })
    for (const response of [await sales(req()), await sessions(req()), await saleDetail(req("include=history"), params()), await cashDetail(req(""), params("cash"))]) {
      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("private, no-store")
      expect(JSON.stringify(await response.json())).not.toMatch(/password|email|sessionVersion|requestHash|barbershopId|actorId|internalNotes|costCents/)
    }
    for (const delegate of [db.sale, db.saleItem, db.payment, db.inventoryMovement, db.commissionEntry, db.cashSession, db.cashMovement, db.checkoutActor, db.checkoutAuditEvent, db.checkoutIdempotency]) {
      for (const key of ["create", "createMany", "update", "updateMany"] as const) expect(delegate[key]).not.toHaveBeenCalled()
    }
    expect(db.$queryRaw).not.toHaveBeenCalled()
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 20000 })
  })
  it("lista o tenant autenticado, preservando registros inativos e snapshots", async () => {
    const response = await sales(req())
    expect(response.status).toBe(200)
    expect(db.sale.findMany.mock.calls[0][0]).toMatchObject({ where: { barbershopId: "shop" }, take: 21, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })
    const body = await response.json()
    expect(body.items[0]).toMatchObject({ customer: { name: "Cliente histórico" }, professionals: [{ name: "Profissional histórico" }], cashRegisterName: "Caixa antigo" })
    expect(JSON.stringify(db.sale.findMany.mock.calls[0][0])).not.toContain('"ACTIVE"')
  })
  it("datas locais têm limites inclusivo/exclusivo, sem usar UTC como dia local", async () => {
    await sales(req("period=custom&start=2026-10-01&end=2026-10-02&dateField=finalizedAt&status=PAID"))
    expect(db.sale.findMany.mock.calls[0][0]).toMatchObject({ where: { AND: expect.arrayContaining([{ status: "PAID" }, { finalizedAt: { gte: new Date("2026-10-01T03:00:00Z"), lt: new Date("2026-10-03T03:00:00Z") } }]) } })
  })
  it("período usa timezone e duração real de um dia com horário de verão", async () => {
    db.barbershop.findFirst.mockResolvedValue({ timezone: "America/New_York" })
    await sales(req("period=custom&start=2026-11-01&end=2026-11-01"))
    expect(db.sale.findMany.mock.calls[0][0]).toMatchObject({ where: { AND: expect.arrayContaining([{ createdAt: { gte: new Date("2026-11-01T04:00:00Z"), lt: new Date("2026-11-02T05:00:00Z") } }]) } })
  })
  it("aplica estado, cliente, sessão e profissional sem aceitar tenant do cliente", async () => {
    await sales(req(`${query}&status=CANCELED&customerId=customer&professionalId=pro&cashSessionId=cash`))
    expect(db.sale.findMany.mock.calls[0][0]).toMatchObject({ where: { barbershopId: "shop", cashSessionId: "cash", AND: expect.arrayContaining([{ status: "CANCELED", finalizedAt: { not: null } }, expect.objectContaining({ barbershopId: "shop", customerId: "customer", saleItem_sale: { some: { barbershopId: "shop", removedAt: null, saleServiceComponent_saleItem: { some: { barbershopId: "shop", professionalId: "pro" } } } } })]) } })
    expect((await sales(req(`${query}&barbershopId=other`))).status).toBe(400)
  })
  it("busca normalizada inclui cliente cadastral e profissional histórico, sem filtro de ativo", async () => {
    await sales(req(`${query}&customerQuery=%20Maria%20%20Silva%20&professionalQuery=Nome%20antigo`))
    const call = db.sale.findMany.mock.calls[0][0]
    expect(call).toMatchObject({ where: { AND: expect.arrayContaining([expect.objectContaining({ customer: { barbershopId: "shop", customerAccount: { name: { contains: "Maria Silva", mode: "insensitive" } } } })]) } })
    expect(JSON.stringify(call)).toContain("professionalNameSnapshot")
    expect(JSON.stringify(call)).not.toContain('"ACTIVE"')
  })
  it("proprietário recebe resumo explícito da revisão sem vazar metadata arbitrária", async () => {
    db.checkoutAuditEvent.findMany.mockResolvedValue([{ action: "sale.edit", createdAt: at, actor: { nameSnapshot: "Operador" }, metadata: {
      before: { version: 0, totalCents: 1000, items: [{ quantity: 1 }] }, after: { version: 1, totalCents: 2000, items: [{ quantity: 2 }] }, secret: "PRIVATE_INTERNAL" } }])
    const body = await (await saleDetail(req("include=history"), params())).json()
    expect(body.history.audit[0]).toMatchObject({ action: "sale.edit", revision: { before: { version: 0, totalCents: 1000, itemCount: 1 }, after: { version: 1, totalCents: 2000, itemCount: 1 } } })
    expect(JSON.stringify(body)).not.toContain("PRIVATE_INTERNAL")
  })
  it("classifica descartes reais e legados no backend sem alterar os estados originais", async () => {
    db.sale.findMany.mockResolvedValue([
      { ...listRow("voided"), status: "VOIDED", finalizedAt: null, voidedAt: at },
      { ...listRow("legacy"), status: "CANCELED", finalizedAt: null, canceledAt: at },
      { ...listRow("canceled"), status: "CANCELED", canceledAt: at },
    ])
    const body = await (await sales(req())).json()
    expect(body.items.map((item: { status: string; closureKind: string }) => [item.status, item.closureKind])).toEqual([
      ["VOIDED", "VOIDED"], ["CANCELED", "LEGACY_VOIDED"], ["CANCELED", "CANCELED"],
    ])
    expect(body.items[0].voidedAt).toBe(at.toISOString())
    expect(body.items[1]).toMatchObject({ canceledAt: at.toISOString(), finalizedAt: null, totalCents: 1000 })
    expect(db.sale.update).not.toHaveBeenCalled()
    expect(db.checkoutIdempotency.update).not.toHaveBeenCalled()
  })
  it("filtro Descarta inclui VOIDED e legado sem incluir cancelamento financeiro", async () => {
    await sales(req(`${query}&status=VOIDED`))
    expect(db.sale.findMany.mock.calls[0][0]).toMatchObject({ where: { barbershopId: "shop", AND: expect.arrayContaining([
      { OR: [{ status: "VOIDED" }, { status: "CANCELED", finalizedAt: null }] },
    ]) } })
  })
  it("data de descarte respeita o timezone e usa canceledAt somente para legados", async () => {
    await sales(req("period=custom&start=2026-10-01&end=2026-10-01&status=VOIDED&dateField=voidedAt"))
    const range = { gte: new Date("2026-10-01T03:00:00Z"), lt: new Date("2026-10-02T03:00:00Z") }
    expect(db.sale.findMany.mock.calls[0][0]).toMatchObject({ where: { AND: expect.arrayContaining([
      { OR: [{ status: "VOIDED", voidedAt: range }, { status: "CANCELED", finalizedAt: null, canceledAt: range }] },
    ]) } })
  })
  it.each(["VOIDED", "LEGACY_VOIDED"])("detalhe preserva snapshots e auditoria para %s", async closure => {
    const row = detailed()
    Object.assign(row, closure === "VOIDED" ? { status: "VOIDED", finalizedAt: null, voidedAt: at, voidReason: "Duplicidade", voidedBy: { nameSnapshot: "Operador do descarte" } } : { status: "CANCELED", finalizedAt: null, canceledAt: at, cancellationReason: "Duplicidade", canceledBy: { nameSnapshot: "Operador do descarte" } })
    db.sale.findFirst.mockResolvedValue(row)
    db.checkoutAuditEvent.findMany.mockResolvedValue([{ action: closure === "VOIDED" ? "sale.void" : "sale.cancel", createdAt: at, actor: { nameSnapshot: "Operador do descarte" } }])
    const body = await (await saleDetail(req("include=history"), params())).json()
    expect(body).toMatchObject({ closureKind: closure, finalizedAt: null, totalCents: row.totalCents, payments: [], history: { stock: [], cash: [], commissions: [] } })
    expect(body.items[0].nameSnapshot).toBe(row.saleItem_sale[0].nameSnapshot)
    expect(body.history.audit[0].actor).toBe("Operador do descarte")
    if (closure === "VOIDED") expect(body).toMatchObject({ voidedAt: at.toISOString(), voidReason: "Duplicidade", voidedByName: "Operador do descarte" })
    else expect(body).toMatchObject({ status: "CANCELED", canceledAt: at.toISOString(), cancellationReason: "Duplicidade", history: { canceledByName: "Operador do descarte" } })
    expect(db.sale.update).not.toHaveBeenCalled()
  })
  it.each(["pageSize=0", "pageSize=51", "pageSize=1.5", "pageSize=-1", "cursor=invalid", "status=UNKNOWN", "status=PAID&status=PENDING", "customerQuery=a", "professionalId=", "dateField=updatedAt", "tenantRole=BARBERSHOP_OWNER", "period=custom&start=2026-02-30&end=2026-03-01", "period=custom&start=2025-01-01&end=2026-10-01"])("recusa query inválida: %s", async suffix => {
    expect((await sales(req(suffix))).status).toBe(400)
    expect(db.sale.findMany).not.toHaveBeenCalled()
  })
  it("barbeiro usa some + every nos componentes e restringe todas as gorjetas ao próprio vínculo", async () => {
    session.mockResolvedValue(role("BARBER").session)
    expect((await sales(req())).status).toBe(200)
    const owned = (db.sale.findMany.mock.calls[0][0] as { where: { AND: unknown[] } }).where.AND[0]
    expect(owned).toMatchObject({ saleItem_sale: { some: { saleServiceComponent_saleItem: { some: { professionalId: "pro" } } }, every: { OR: [{ removedAt: { not: null } }, { barbershopId: "shop", saleServiceComponent_saleItem: { every: { barbershopId: "shop", professionalId: "pro" } } }] } }, saleTip_sale: { every: { OR: [{ removedAt: { not: null } }, { barbershopId: "shop", professionalId: "pro" }] } } })
    expect((await sales(req(`${query}&professionalId=another`))).status).toBe(403)
    expect((await sessions(req())).status).toBe(403)
    expect((await cashDetail(req(""), params("cash"))).status).toBe(403)
  })
  it("detalhe recusa operação mista de outro profissional antes de ler ledgers", async () => {
    session.mockResolvedValue(role("BARBER").session)
    const row = detailed(); row.saleItem_sale[0].saleServiceComponent_saleItem[0].professionalId = "another"
    db.sale.findFirst.mockResolvedValue(row)
    expect((await saleDetail(req("include=history"), params())).status).toBe(403)
    expect(db.inventoryMovement.findMany).not.toHaveBeenCalled()
  })
  it.each(["BARBER", "ASSISTANT"] as const)("%s não recebe comissão interna ou auditoria", async tenantRole => {
    session.mockResolvedValue(role(tenantRole).session)
    const response = await saleDetail(req("include=history"), params()), body = await response.json()
    expect(response.status).toBe(200)
    expect(body.history.commissions).toBeNull()
    expect(body.history.audit).toEqual([])
    expect(body.items[0].components[0]).not.toHaveProperty("commissionBasisPoints")
    expect(db.commissionEntry.findMany).not.toHaveBeenCalled()
    expect(db.checkoutAuditEvent.findMany).not.toHaveBeenCalled()
    if (tenantRole === "BARBER") expect(db.cashMovement.findMany).not.toHaveBeenCalled()
  })
  it("proprietário recebe lançamentos originais e reversões sem apresentar repasse como confirmado", async () => {
    db.commissionEntry.findMany.mockResolvedValue([{ id: "commission", kind: "EARNED", status: "REVERSED", amountCents: 400, createdAt: at, reversalOfId: null, component: { professionalNameSnapshot: "Nome antigo" } }, { id: "reverse", kind: "REVERSAL", status: "POSTED", amountCents: 400, createdAt: at, reversalOfId: "commission", component: { professionalNameSnapshot: "Nome antigo" } }])
    db.checkoutAuditEvent.findMany.mockResolvedValue([{ action: "sale.cancel", createdAt: at, actor: { nameSnapshot: "Proprietário" } }])
    const body = await (await saleDetail(req("include=history"), params())).json()
    expect(body.history.commissions.map((entry: { kind: string }) => entry.kind)).toEqual(["EARNED", "REVERSAL"])
    expect(body.history.audit[0].actor).toBe("Proprietário")
    expect(body.history).not.toHaveProperty("externalRefundConfirmed")
  })
  it("GET individual padrão conserva o contrato sem ler os históricos", async () => {
    const response = await saleDetail(req(""), params())
    expect(response.status).toBe(200)
    expect(await response.json()).not.toHaveProperty("history")
    expect(db.inventoryMovement.findMany).not.toHaveBeenCalled()
    expect(db.barbershop.findFirst).not.toHaveBeenCalled()
  })
  it("recursos de outro tenant permanecem ausentes, inclusive nos detalhes complementares", async () => {
    db.sale.findFirst.mockResolvedValue(null); db.cashSession.findFirst.mockResolvedValue(null)
    expect((await saleDetail(req("include=history"), params("foreign"))).status).toBe(404)
    expect((await cashDetail(req(""), params("foreign"))).status).toBe(404)
    expect(db.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop", id: "foreign" } }))
    expect(db.cashSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop", id: "foreign" } }))
  })
})

describe("Históricos Checkout: paginação e conferência", () => {
  it("cursor desempata datas iguais e não depende da existência posterior da linha", async () => {
    db.sale.findMany.mockResolvedValueOnce([listRow("c"), listRow("b"), listRow("a")])
    const first = await (await sales(req(`${query}&pageSize=2`))).json()
    expect(first.items.map((row: { id: string }) => row.id)).toEqual(["c", "b"])
    expect(first.hasMore).toBe(true)
    db.sale.findMany.mockResolvedValueOnce([listRow("a")])
    const next = await (await sales(req(`${query}&pageSize=2&cursor=${first.nextCursor}`))).json()
    expect(next.hasMore).toBe(false); expect(next.nextCursor).toBeNull()
    expect(db.sale.findMany.mock.calls[1][0]).toMatchObject({ where: { AND: expect.arrayContaining([{ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: "b" } }] }]) }, take: 3 })
    expect(db.sale.findMany.mock.calls[1][0]).not.toHaveProperty("skip")
    expect((await sales(req(`${query}&pageSize=3&cursor=${first.nextCursor}`))).status).toBe(400)
  })
  it("cursor não é compartilhável entre tenants, operadores ou filtros", async () => {
    db.sale.findMany.mockResolvedValue([listRow("b"), listRow("a")])
    const first = await (await sales(req(`${query}&pageSize=1`))).json()
    session.mockResolvedValue({ ...owner.session, barbershopId: "other" })
    expect((await sales(req(`${query}&pageSize=1&cursor=${first.nextCursor}`))).status).toBe(400)
  })
  it("caixa retorna totais de todos os movimentos, não somente da página", async () => {
    db.cashMovement.groupBy.mockResolvedValue([{ kind: "OPENING", _sum: { amountCents: 5000 } }, { kind: "SUPPLY", _sum: { amountCents: 1000 } }, { kind: "WITHDRAWAL", _sum: { amountCents: 500 } }, { kind: "REVERSAL", _sum: { amountCents: 200 } }])
    const movement = { id: "move", kind: "SALE", amountCents: 100, reason: "Venda", createdAt: at, saleId: "sale", reversalOfId: null, actor: { nameSnapshot: "Operador" }, cashSession: { id: "cash", status: "CLOSED", cashRegister: { name: "Caixa antigo" } } }
    db.cashMovement.findMany.mockResolvedValue([{ ...movement, id: "b" }, { ...movement, id: "a" }])
    const body = await (await cashDetail(req("pageSize=1"), params("cash"))).json()
    expect(body.ledgerBalanceCents).toBe(5300)
    expect(body.session).toMatchObject({ status: "CLOSED", expectedBalanceCents: 5000, countedBalanceCents: 4900, differenceCents: -100 })
    expect(body.movements.items).toHaveLength(1); expect(body.movements.hasMore).toBe(true)
    expect(db.cashMovement.groupBy).toHaveBeenCalledWith({ by: ["kind"], where: { barbershopId: "shop", cashSessionId: "cash" }, _sum: { amountCents: true } })
  })
  it("assistente não recebe notas privadas da sessão", async () => {
    session.mockResolvedValue(role("ASSISTANT").session)
    const body = await (await cashDetail(req(""), params("cash"))).json()
    expect(body.notes).toBeNull()
    expect((db.cashSession.findFirst.mock.calls[0][0] as { select: unknown }).select).not.toHaveProperty("notes")
  })
  it("filtros de caixa abrangem vendas e devoluções feitas em outra sessão", async () => {
    await sessions(req(`${query}&status=CLOSED&dateField=closedAt&customerId=customer&professionalId=pro`))
    expect(db.cashSession.findMany.mock.calls[0][0]).toMatchObject({ where: { barbershopId: "shop", status: "CLOSED", closedAt: expect.any(Object), OR: [{ sale_cashSession: { some: expect.objectContaining({ barbershopId: "shop", customerId: "customer" }) } }, { cashMovement_cashSession: { some: { barbershopId: "shop", sale: expect.objectContaining({ customerId: "customer" }) } } }] }, take: 21 })
  })
  it("erros internos não expõem detalhes de SQL", async () => {
    db.sale.findMany.mockRejectedValue(new Error("SECRET SQL password"))
    const response = await sales(req())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ message: "Erro interno do servidor." })
  })
  it("fábrica de leitura usa somente o cliente injetado e o callback recebido", async () => {
    const transaction = vi.fn(async (work: (tx: typeof db) => Promise<unknown>) => work(db))
    const client = new Proxy({ $transaction: transaction }, { get(target, key) { if (key === "$transaction") return target.$transaction; throw new Error("Escapou do cliente transacional") } })
    const services = createCheckoutServices(client as unknown as CheckoutClient)
    expect((await services.listSales(owner, new URLSearchParams(query))).status).toBe(200)
    expect(transaction).toHaveBeenCalledOnce()
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
