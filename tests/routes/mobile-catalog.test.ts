import { describe, expect, it } from "vitest"

import { expectJson } from "../helpers/route-assertions"
import { prismaMock } from "../setup/prisma-mock"

import { GET as GET_BARBERSHOP } from "@/app/api/mobile/v1/barbershops/[slug]/route"
import { GET as GET_PROFESSIONALS } from "@/app/api/mobile/v1/barbershops/[slug]/professionals/route"
import { GET as GET_SERVICES } from "@/app/api/mobile/v1/barbershops/[slug]/services/route"

const context = (slug = "mr-dyllan") => ({ params: Promise.resolve({ slug }) })
const shop = {
  id: "shop-one",
  slug: "mr-dyllan",
  name: "Mr Dyllan",
  address: "Rua Um",
  phone: "65999999999",
  timezone: "America/Cuiaba",
}

function request(query = "") {
  return new Request(`http://test/api/mobile/v1/barbershops/mr-dyllan/professionals${query}`)
}

describe("API publica mobile do catalogo", () => {
  it("retorna 404 estavel para slug inexistente ou inativo", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue(null)
    const body = await expectJson(
      await GET_BARBERSHOP(new Request("http://test/x"), context("missing")),
      404
    )
    expect(body).toEqual({
      error: { code: "BARBERSHOP_NOT_FOUND", message: "Barbearia nao encontrada." },
    })
    expect(prismaMock.barbershop.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "missing", status: "ACTIVE" },
    }))
  })

  it("projeta somente os campos publicos da barbearia", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue(shop)
    const body = await expectJson(
      await GET_BARBERSHOP(new Request("http://test/x"), context()),
      200
    )
    expect(body).toEqual(shop)
    expect(prismaMock.barbershop.findFirst).toHaveBeenCalledWith({
      where: { slug: "mr-dyllan", status: "ACTIVE" },
      select: { id: true, slug: true, name: true, address: true, phone: true, timezone: true },
    })
  })

  it("lista somente servicos ativos do tenant na ordem publica", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue(shop)
    prismaMock.service.findMany.mockResolvedValue([
      { id: "s1", name: "Barba", description: null, priceCents: 3000, durationMinutes: 30, displayOrder: 1 },
    ])
    const body = await expectJson(
      await GET_SERVICES(new Request("http://test/x"), context()),
      200
    )
    expect(prismaMock.service.findMany).toHaveBeenCalledWith({
      where: { barbershopId: "shop-one", status: "ACTIVE" },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, description: true, priceCents: true, durationMinutes: true, displayOrder: true, category: { select: { id: true, name: true, displayOrder: true } } },
    })
    expect(body).toEqual([
      { id: "s1", name: "Barba", description: null, priceCents: 3000, durationMinutes: 30, displayOrder: 1 },
    ])
  })

  it("retorna somente profissionais ativos associados e projecao segura", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue(shop)
    prismaMock.professional.findMany.mockResolvedValue([
      {
        id: "p1", name: "Ana", role: "Barbeira", photoUrl: null,
        services: [{ serviceId: "s1" }],
        email: "must-not-leak@test.com", commission: 50,
      },
    ])
    const body = await expectJson(await GET_PROFESSIONALS(request(), context()), 200)
    expect(prismaMock.professional.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        barbershopId: "shop-one",
        status: "ACTIVE",
        services: { some: { service: { status: "ACTIVE" } } },
      },
    }))
    expect(body).toEqual([
      { id: "p1", name: "Ana", role: "Barbeira", photoUrl: null, serviceIds: ["s1"] },
    ])
    expect(JSON.stringify(body)).not.toContain("email")
    expect(JSON.stringify(body)).not.toContain("accessEmail")
    expect(JSON.stringify(body)).not.toContain("commission")
    expect(JSON.stringify(body)).not.toContain("status")
  })

  it("deduplica IDs e exige que todos os servicos perten?am ao tenant", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue(shop)
    prismaMock.service.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }])
    prismaMock.professional.findMany.mockResolvedValue([
      { id: "both", name: "Ambos", role: "Barbeiro", photoUrl: null, services: [{ serviceId: "s1" }, { serviceId: "s2" }] },
      { id: "one", name: "Um", role: "Barbeiro", photoUrl: null, services: [{ serviceId: "s1" }] },
    ])
    const body = await expectJson(
      await GET_PROFESSIONALS(request("?serviceIds=s1,s1&serviceIds=s2"), context()),
      200
    )
    expect(prismaMock.service.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] }, barbershopId: "shop-one", status: "ACTIVE" },
      select: { id: true },
    })
    expect(body).toEqual([
      { id: "both", name: "Ambos", role: "Barbeiro", photoUrl: null, serviceIds: ["s1", "s2"] },
    ])
  })

  it("servico invalido ou de outro tenant nao amplia resultados", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue(shop)
    prismaMock.service.findMany.mockResolvedValue([{ id: "s1" }])
    const body = await expectJson(
      await GET_PROFESSIONALS(request("?serviceIds=s1,other-tenant"), context()),
      400
    )
    expect(body).toEqual({ error: { code: "INVALID_QUERY", message: "Servico invalido." } })
    expect(prismaMock.professional.findMany).not.toHaveBeenCalled()
  })

  it.each([
    ["vazio", "?serviceIds="],
    ["chave desconhecida", "?barbershopId=attacker"],
    ["mais de vinte", `?serviceIds=${Array.from({ length: 21 }, (_, index) => `s${index}`).join(",")}`],
  ])("retorna 400 para query %s", async (_name, query) => {
    const body = await expectJson(await GET_PROFESSIONALS(request(query), context()), 400)
    expect(body).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: "INVALID_QUERY" }) }))
    expect(prismaMock.barbershop.findFirst).not.toHaveBeenCalled()
  })

  it("sanitiza erro Prisma", async () => {
    prismaMock.barbershop.findFirst.mockRejectedValue(new Error("database secret P2002"))
    const body = await expectJson(
      await GET_BARBERSHOP(new Request("http://test/x"), context()),
      500
    )
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor." } })
    expect(JSON.stringify(body)).not.toContain("database secret")
  })
})
