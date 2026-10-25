import { beforeEach, describe, expect, it, vi } from "vitest"
import { db, owner, role, setupCheckout } from "../setup/checkout"
const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: session }))
import { GET } from "@/app/api/checkout/bootstrap/route"
import { canAccess } from "@/lib/permissions"
import { Prisma } from "@prisma/client"

const request = (query = "") => new Request(`http://test/api/checkout/bootstrap${query}`)
beforeEach(() => {
  setupCheckout(); session.mockResolvedValue(owner.session)
  db.service.findMany.mockResolvedValue([{ id: "cut", name: "Corte", priceCents: 1000, durationMinutes: 30, category: { id: "category", name: "Cabelo", status: "ACTIVE" }, secret: "SECRET" }, { id: "beard", name: "Barba", priceCents: 500, durationMinutes: 20, category: null }])
  db.servicePackage.findMany.mockResolvedValue([{ id: "combo", name: "Combo", priceCents: 1200, durationMinutes: 50, items: [{ serviceId: "cut" }, { serviceId: "beard" }] }])
  db.professional.findMany.mockResolvedValue([{ id: "pro", name: "André", services: [{ serviceId: "cut" }, { serviceId: "beard" }], email: "SECRET", commission: 40 }])
  db.product.findMany.mockResolvedValue([{ id: "product", name: "Pomada", priceCents: 700, inventoryBalance_product: { quantity: 3 }, costCents: 100, barcode: "SECRET" }])
  db.cashRegister.findMany.mockResolvedValue([{ id: "register", name: "Recepção", secret: "SECRET" }])
  db.cashSession.findMany.mockResolvedValue([{ id: "cash", cashRegisterId: "register", status: "OPEN", openedAt: new Date("2026-10-22T10:00:00Z"), openingBalanceCents: 5000, openedBy: { nameSnapshot: "Operador" }, notes: "SECRET" }])
  db.barbershopCustomer.findMany.mockResolvedValue([{ id: "customer", customerAccount: { name: "Maria", email: "SECRET", passwordHash: "SECRET" }, internalNotes: "SECRET" }])
})
describe("Bootstrap tenant-safe do Checkout", () => {
  it.each(["cashRegister", "cashSession", "product"] as const)("reproduz tabela ausente (P2021) em %s sem ocultar falha ou expor detalhes", async model => {
    // Same structured Prisma failure observed locally, not an arbitrary Error(500).
    db[model].findMany.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("SECRET SQL credentials", { code: "P2021", clientVersion: "6.6.0", meta: { modelName: model, table: "private_table" } }))
    const response = await GET(request()), body = await response.json()
    expect(response.status).toBe(500)
    expect(body).toEqual({ message: "Erro interno do servidor." })
    expect(body).not.toHaveProperty("products")
    expect(JSON.stringify(body)).not.toMatch(/SECRET|SQL|credentials|private_table|P2021|modelName/)
    expect(db[model].findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ barbershopId: "shop" }) }))
    expect(db.$transaction).not.toHaveBeenCalled()
    for (const delegate of [db.product, db.cashRegister, db.cashSession]) expect(delegate.create).not.toHaveBeenCalled()
  })
  it("401 sem sessão e 403 para super admin sem tenant", async () => {
    session.mockResolvedValue(null); expect((await GET(request())).status).toBe(401)
    session.mockResolvedValue({ type: "USER", globalRole: "SUPER_ADMIN", tenantRole: null, barbershopId: null }); expect((await GET(request())).status).toBe(403)
    expect(db.service.findMany).not.toHaveBeenCalled()
  })
  it("proprietário: DTO explícito, catálogo, estoque e sessões sem campos sensíveis", async () => {
    const response = await GET(request("?customerQuery=Maria")), body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(body.operator.permissions).toEqual({ sell: true, cash: true, discount: true, cancel: true })
    expect(body.products).toEqual([{ id: "product", name: "Pomada", priceCents: 700, availableQuantity: 3 }])
    expect(body.services[0].category).toEqual({ id: "category", name: "Cabelo" })
    expect(body.packages[0].services.map((s: { id: string }) => s.id)).toEqual(["cut", "beard"])
    expect(body.openSessions[0]).toEqual({ id: "cash", cashRegisterId: "register", status: "OPEN", openedAt: "2026-10-22T10:00:00.000Z", openingBalanceCents: 5000, operatorName: "Operador" })
    expect(body.customers).toEqual([{ id: "customer", name: "Maria" }])
    expect(JSON.stringify(body)).not.toMatch(/SECRET|email|password|token|commission|costCents|notes|barbershopId|PIX/)
  })
  it("assistente recebe somente permissões já existentes", async () => {
    session.mockResolvedValue(role("ASSISTANT").session)
    const body = await (await GET(request())).json()
    expect(body.operator.permissions).toEqual({ sell: true, cash: true, discount: false, cancel: false })
    expect(canAccess("ASSISTANT", "checkout:cancel")).toBe(false)
    expect(canAccess("ASSISTANT", "checkout:discount")).toBe(false)
  })
  it("barbeiro: profissional próprio, catálogo habilitado e apenas ID/estado da sessão", async () => {
    session.mockResolvedValue(role("BARBER").session)
    db.professional.findMany.mockResolvedValue([{ id: "pro", name: "André", services: [{ serviceId: "cut" }] }])
    const body = await (await GET(request())).json()
    expect(body.services.map((s: { id: string }) => s.id)).toEqual(["cut"])
    expect(body.packages).toEqual([])
    expect(body.professionals.map((p: { id: string }) => p.id)).toEqual(["pro"])
    expect(body.operator.professionalId).toBe("pro")
    expect(body.openSessions).toEqual([{ id: "cash", cashRegisterId: "register", status: "OPEN" }])
    expect(body.operator.permissions).toEqual({ sell: true, cash: false, discount: false, cancel: false })
    expect(db.professional.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop", status: "ACTIVE", id: "pro" } }))
    expect(canAccess("BARBER", "checkout:cash")).toBe(false)
  })
  it("isolamento: todas as consultas usam exclusivamente o tenant da sessão", async () => {
    session.mockResolvedValue({ ...owner.session, barbershopId: "other" })
    await GET(request("?customerQuery=Maria"))
    for (const delegate of [db.service, db.servicePackage, db.professional, db.product, db.cashRegister, db.cashSession, db.barbershopCustomer]) expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ barbershopId: "other" }) }))
  })
  it.each(["?barbershopId=other", "?role=BARBERSHOP_OWNER", "?operatorId=owner", "?customerQuery=aa&customerQuery=bb"])("rejeita entrada não autorizada %s", async query => {
    expect((await GET(request(query))).status).toBe(400); expect(db.service.findMany).not.toHaveBeenCalled()
  })
  it.each(["", "?customerQuery=", "?customerQuery=%20%20"])("sem termo não consulta clientes %s", async query => {
    expect((await (await GET(request(query))).json()).customers).toEqual([])
    expect(db.barbershopCustomer.findMany).not.toHaveBeenCalled()
  })
  it("termo curto ou excessivo retorna 400 sem consultas", async () => {
    expect((await GET(request("?customerQuery=a"))).status).toBe(400)
    expect((await GET(request(`?customerQuery=${"a".repeat(81)}`))).status).toBe(400)
    expect(db.barbershopCustomer.findMany).not.toHaveBeenCalled()
  })
  it("normaliza busca, limita a 20 e não expõe informação privada", async () => {
    await GET(request("?customerQuery=%20Maria%20%20Silva%20"))
    expect(db.barbershopCustomer.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20, where: { barbershopId: "shop", status: "ACTIVE", customerAccount: { name: { contains: "Maria Silva", mode: "insensitive" } } }, select: { id: true, customerAccount: { select: { name: true } } } }))
  })
  it("consulta somente registros ativos; caixa pertence ao tenant e está ativo", async () => {
    await GET(request())
    for (const delegate of [db.service, db.servicePackage, db.professional, db.product]) expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) }))
    expect(db.cashRegister.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop", active: true } }))
    expect(db.cashSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { barbershopId: "shop", status: "OPEN", cashRegister: { active: true, barbershopId: "shop" } } }))
    expect(db.servicePackage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ items: { every: { service: { status: "ACTIVE", barbershopId: "shop" } } } }) }))
  })
  it("estoque ausente é zero e categoria inativa não é retornada", async () => {
    db.product.findMany.mockResolvedValue([{ id: "product", name: "Pomada", priceCents: 700, inventoryBalance_product: null }])
    db.service.findMany.mockResolvedValue([{ id: "cut", name: "Corte", priceCents: 1000, durationMinutes: 30, category: { id: "inactive", name: "Antiga", status: "INACTIVE" } }])
    const body = await (await GET(request())).json()
    expect(body.products[0].availableQuantity).toBe(0); expect(body.services[0].category).toBeNull()
  })
})
