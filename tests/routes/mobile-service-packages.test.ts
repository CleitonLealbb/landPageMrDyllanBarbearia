import { describe, expect, it } from "vitest"

import { GET as GET_COMBOS } from "@/app/api/mobile/v1/barbershops/[slug]/combos/route"
import { GET as GET_PACKAGES } from "@/app/api/mobile/v1/barbershops/[slug]/packages/route"

import { expectJson } from "../helpers/route-assertions"
import { prismaMock } from "../setup/prisma-mock"

const context = (slug = "shop") => ({ params: Promise.resolve({ slug }) })
const request = new Request("http://test/api/mobile/v1/barbershops/shop/combos")
const service = (id: string, priceCents: number, durationMinutes: number, status = "ACTIVE") => ({
  id,
  name: id,
  priceCents,
  durationMinutes,
  status,
  category: null,
})

describe("API publica mobile de combos", () => {
  it.each(["inexistente", "inativa"])("retorna 404 para barbearia %s", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue(null)
    await expectJson(await GET_COMBOS(request, context()), 404)
    expect(prismaMock.barbershop.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "shop", status: "ACTIVE" },
    }))
    expect(prismaMock.servicePackage.findMany).not.toHaveBeenCalled()
  })

  it("consulta somente combos ativos com servicos ativos e ordena", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue({ id: "tenant" })
    prismaMock.servicePackage.findMany.mockResolvedValue([])
    await expectJson(await GET_COMBOS(request, context()), 200)
    expect(prismaMock.servicePackage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        barbershopId: "tenant",
        status: "ACTIVE",
        items: { every: { service: { status: "ACTIVE" } } },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: expect.objectContaining({ durationMinutes: true }),
    }))
  })

  it("usa duracao persistida, deriva apenas o total individual e projeta campos publicos", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue({ id: "tenant" })
    prismaMock.servicePackage.findMany.mockResolvedValue([
      {
        id: "invalid",
        name: "Um",
        description: null,
        priceCents: 1000,
        durationMinutes: 15,
        displayOrder: 0,
        items: [{ service: service("s1", 2000, 20) }],
      },
      {
        id: "valid",
        name: "Dois",
        description: null,
        priceCents: 3000,
        durationMinutes: 75,
        displayOrder: 1,
        status: "ACTIVE",
        barbershopId: "tenant",
        items: [
          { service: service("s1", 2000, 20) },
          { service: service("s2", 2500, 30) },
        ],
      },
    ])
    const body = await expectJson(await GET_COMBOS(request, context()), 200) as unknown[]
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: "valid",
      priceCents: 3000,
      originalPriceCents: 4500,
      durationMinutes: 75,
      displayOrder: 1,
    })
    expect(JSON.stringify(body)).not.toMatch(/barbershopId|status|internal|createdAt|updatedAt/)
  })

  it("mantem /packages como alias compativel", async () => {
    prismaMock.barbershop.findFirst.mockResolvedValue({ id: "tenant" })
    prismaMock.servicePackage.findMany.mockResolvedValue([])
    expect(await expectJson(await GET_PACKAGES(request, context()), 200)).toEqual([])
  })

  it("sanitiza erro interno", async () => {
    prismaMock.barbershop.findFirst.mockRejectedValue(new Error("secret"))
    const body = await expectJson(await GET_COMBOS(request, context()), 500)
    expect(JSON.stringify(body)).not.toContain("secret")
  })
})
