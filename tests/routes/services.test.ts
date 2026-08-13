import { beforeEach, describe, expect, it, vi } from "vitest"

import { expectJson, expectNoSensitiveData, jsonRequest } from "../helpers/route-assertions"
import { prismaMock } from "../setup/prisma-mock"
import {
  ownerSession,
  professionalAssistantSession,
  professionalBarberSession,
  superAdminSession,
} from "../setup/session-fixtures"

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }))

import { GET, POST } from "@/app/api/services/route"

const validBody = {
  name: " Corte ",
  description: " Tradicional ",
  priceCents: 5000,
  durationMinutes: 40,
  displayOrder: 1,
  status: "ACTIVE",
}

function allowOwner() {
  getSessionMock.mockResolvedValue(ownerSession)
  prismaMock.barbershopUser.findFirst.mockResolvedValue({ id: "membership" })
}

function mockTransaction() {
  prismaMock.$transaction.mockImplementation(async (...args: unknown[]) => {
    const callback = args[0] as (transaction: typeof prismaMock) => Promise<unknown>
    return callback(prismaMock)
  })
}

describe("/api/services", () => {
  beforeEach(allowOwner)

  it.each([
    ["sem sessao", null, 401],
    ["super admin", superAdminSession, 403],
    ["professional barber", professionalBarberSession, 403],
    ["professional assistant", professionalAssistantSession, 403],
    ["user barber", { ...ownerSession, tenantRole: "BARBER" }, 403],
    ["user assistant", { ...ownerSession, tenantRole: "ASSISTANT" }, 403],
  ])("bloqueia %s sem consulta de negocio", async (_name, session, status) => {
    getSessionMock.mockResolvedValue(session)
    await expectJson(await GET(), status)
    await expectJson(
      await POST(jsonRequest("http://test/api/services", "POST", validBody)),
      status
    )
    expect(prismaMock.service.findMany).not.toHaveBeenCalled()
    expect(prismaMock.professional.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("bloqueia owner sem membership ativa", async () => {
    prismaMock.barbershopUser.findFirst.mockResolvedValue(null)
    await expectJson(await GET(), 403)
    expect(prismaMock.barbershopUser.findFirst).toHaveBeenCalledWith({
      where: {
        userId: ownerSession.userId,
        barbershopId: ownerSession.barbershopId,
        role: "BARBERSHOP_OWNER",
        barbershop: { status: "ACTIVE" },
      },
      select: { id: true },
    })
    expect(prismaMock.service.findMany).not.toHaveBeenCalled()
  })

  it("lista somente o tenant derivado da sessao", async () => {
    prismaMock.service.findMany.mockResolvedValue([])
    await expectJson(await GET(), 200)
    expect(prismaMock.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { barbershopId: ownerSession.barbershopId } })
    )
  })

  it.each([
    ["preco negativo", { ...validBody, priceCents: -1 }],
    ["preco decimal", { ...validBody, priceCents: 1.5 }],
    ["duracao zero", { ...validBody, durationMinutes: 0 }],
    ["duracao decimal", { ...validBody, durationMinutes: 1.5 }],
    ["ordem negativa", { ...validBody, displayOrder: -1 }],
    ["status desconhecido", { ...validBody, status: "PENDING" }],
    ["campo inesperado", { ...validBody, barbershopId: "attacker-tenant" }],
  ])("rejeita %s sem mutacao", async (_name, body) => {
    await expectJson(await POST(jsonRequest("http://test/api/services", "POST", body)), 400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("recusa profissional de outro tenant antes da transacao", async () => {
    prismaMock.professional.findMany.mockResolvedValue([{ id: "professional-one" }])
    const request = jsonRequest("http://test/api/services", "POST", {
      ...validBody,
      professionalIds: ["professional-one", "other-tenant-professional"],
    })
    await expectJson(await POST(request), 400)
    expect(prismaMock.professional.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["professional-one", "other-tenant-professional"] },
        barbershopId: ownerSession.barbershopId,
      },
      select: { id: true },
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("recusa categoria inativa ou de outro tenant", async () => {
    prismaMock.serviceCategory.findFirst.mockResolvedValue(null)
    await expectJson(await POST(jsonRequest("http://test/api/services", "POST", { ...validBody, categoryId: "invalid" })), 400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("cria servico e associacoes deduplicadas em transacao", async () => {
    prismaMock.professional.findMany.mockResolvedValue([{ id: "professional-one" }])
    prismaMock.service.create.mockResolvedValue({
      id: "service-one",
      name: "Corte",
      professionals: [{ professional: { id: "professional-one", name: "Ana", role: "Barbeira", photoUrl: null } }],
    })
    mockTransaction()

    const body = await expectJson(
      await POST(jsonRequest("http://test/api/services", "POST", {
        ...validBody,
        barbershopId: "attacker-tenant",
        professionalIds: ["professional-one", "professional-one"],
      })),
      400
    )
    expect(body).toEqual(expect.objectContaining({ message: expect.any(String) }))
    expect(prismaMock.$transaction).not.toHaveBeenCalled()

    const created = await expectJson(
      await POST(jsonRequest("http://test/api/services", "POST", {
        ...validBody,
        professionalIds: ["professional-one", "professional-one"],
      })),
      201
    )
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.service.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        barbershopId: ownerSession.barbershopId,
        name: "Corte",
        professionals: { create: [{ barbershopId: ownerSession.barbershopId, professionalId: "professional-one" }] },
      }),
    }))
    expectNoSensitiveData(created)
    expect(JSON.stringify(created)).not.toContain("email")
    expect(JSON.stringify(created)).not.toContain("commission")
  })

  it("retorna 409 sanitizado para nome duplicado", async () => {
    prismaMock.$transaction.mockRejectedValue({ code: "P2002", meta: { target: "database secret" } })
    const body = await expectJson(
      await POST(jsonRequest("http://test/api/services", "POST", validBody)),
      409
    )
    expect(body).toEqual({ message: "Ja existe um servico com este nome." })
  })

  it("sanitiza erro interno", async () => {
    prismaMock.service.findMany.mockRejectedValue(new Error("database secret"))
    const body = await expectJson(await GET(), 500)
    expect(body).toEqual({ message: "Erro interno do servidor." })
  })
})
