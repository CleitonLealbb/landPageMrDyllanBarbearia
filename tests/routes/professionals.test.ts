import { beforeEach, describe, expect, it, vi } from "vitest"

import { prismaMock } from "../setup/prisma-mock"
import {
  ownerSession,
  professionalAssistantSession,
  professionalBarberSession,
  superAdminSession,
} from "../setup/session-fixtures"
import { expectJson, expectNoSensitiveData, jsonRequest } from "../helpers/route-assertions"

const { getSessionMock, getCurrentBarbershopMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getCurrentBarbershopMock: vi.fn(),
}))
vi.mock("@/lib/auth/session", () => ({
  getSession: getSessionMock,
  getCurrentBarbershop: getCurrentBarbershopMock,
}))
vi.mock("resend", () => ({
  Resend: class ForbiddenResend {
    constructor() { throw new Error("Unexpected Resend construction") }
  },
}))

import { GET, POST } from "@/app/api/professionals/route"

const userBarber = { ...ownerSession, userId: "barber-user", tenantRole: "BARBER" } as const
const userAssistant = { ...ownerSession, userId: "assistant-user", tenantRole: "ASSISTANT" } as const
const validBody = {
  name: " Barber ", email: "barber@test.com", role: "Cabeleireiro", permissionLevel: "BARBER",
  commission: 40, specialties: ["Corte"], photoUrl: "https://images.test/photo.jpg",
  barbershopId: "attacker-controlled-tenant",
}

function allowOwner() {
  getSessionMock.mockResolvedValue(ownerSession)
  getCurrentBarbershopMock.mockResolvedValue({ id: ownerSession.barbershopId, name: "One" })
  prismaMock.barbershopUser.findFirst.mockResolvedValue({ id: "membership" })
}

describe("/api/professionals", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(ownerSession)
    getCurrentBarbershopMock.mockResolvedValue({ id: ownerSession.barbershopId, name: "One" })
  })

  it.each([GET, async () => POST(jsonRequest("http://test/x", "POST", validBody))])(
    "%s retorna 401 sem sessao sem Prisma",
    async (invoke) => {
      getSessionMock.mockResolvedValue(null)
      await expectJson(await invoke(), 401)
      expect(prismaMock.barbershopUser.findFirst).not.toHaveBeenCalled()
      expect(prismaMock.professional.findMany).not.toHaveBeenCalled()
      expect(prismaMock.professional.create).not.toHaveBeenCalled()
    }
  )

  it.each([superAdminSession, userBarber, userAssistant, professionalBarberSession, professionalAssistantSession])(
    "GET e POST retornam 403 para identidade sem permissao $type/$tenantRole",
    async (session) => {
      getSessionMock.mockResolvedValue(session)
      await expectJson(await GET(), 403)
      await expectJson(await POST(jsonRequest("http://test/x", "POST", validBody)), 403)
      expect(getCurrentBarbershopMock).not.toHaveBeenCalled()
      expect(prismaMock.professional.create).not.toHaveBeenCalled()
    }
  )

  it("owner sem membership retorna 403", async () => {
    allowOwner()
    prismaMock.barbershopUser.findFirst.mockResolvedValue(null)
    await expectJson(await GET(), 403)
    expect(prismaMock.professional.findMany).not.toHaveBeenCalled()
  })

  it("barbearia inativa ou ausente retorna 404 no comportamento atual", async () => {
    getSessionMock.mockResolvedValue(ownerSession)
    getCurrentBarbershopMock.mockResolvedValue(null)
    await expectJson(await GET(), 404)
    expect(prismaMock.barbershopUser.findFirst).not.toHaveBeenCalled()
  })

  it("GET filtra exclusivamente pelo tenant validado", async () => {
    allowOwner()
    const rows = [{ id: "professional", name: "Barber", permissionLevel: "BARBER", status: "ACTIVE" }]
    prismaMock.professional.findMany.mockResolvedValue(rows)
    const body = await expectJson(await GET(), 200)
    expect(prismaMock.professional.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { barbershopId: ownerSession.barbershopId } })
    )
    expectNoSensitiveData(body)
  })

  it("POST invalido retorna 400 sem criar", async () => {
    allowOwner()
    await expectJson(await POST(jsonRequest("http://test/x", "POST", { name: "Only" })), 400)
    expect(prismaMock.professional.create).not.toHaveBeenCalled()
  })

  it("POST rejeita permissionLevel invalido", async () => {
    allowOwner()
    await expectJson(
      await POST(jsonRequest("http://test/x", "POST", { ...validBody, permissionLevel: "OWNER" })),
      400
    )
    expect(prismaMock.professional.create).not.toHaveBeenCalled()
  })

  it("POST retorna 409 em duplicidade", async () => {
    allowOwner()
    prismaMock.professional.findFirst.mockResolvedValue({ id: "duplicate" })
    await expectJson(await POST(jsonRequest("http://test/x", "POST", validBody)), 409)
    expect(prismaMock.professional.create).not.toHaveBeenCalled()
  })

  it("POST ignora tenant do cliente, cria no tenant validado e nao expoe segredos", async () => {
    allowOwner()
    prismaMock.professional.findFirst.mockResolvedValue(null)
    const created = {
      id: "professional", name: "Barber", email: "barber@test.com", role: "Cabeleireiro",
      permissionLevel: "BARBER", commission: 40, specialties: ["Corte"], photoUrl: null, status: "PENDING",
    }
    prismaMock.professional.create.mockResolvedValue(created)
    const body = await expectJson(await POST(jsonRequest("http://test/x", "POST", validBody)), 201)
    expect(prismaMock.professional.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ barbershopId: ownerSession.barbershopId }),
      select: expect.not.objectContaining({ password: true, inviteToken: true, sessionVersion: true }),
    }))
    expect(prismaMock.professional.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ barbershopId: validBody.barbershopId }) })
    )
    expectNoSensitiveData(body)
  })

  it.fails("documenta que falha interna ainda nao e sanitizada", async () => {
    allowOwner()
    prismaMock.professional.findMany.mockRejectedValue(new Error("database secret"))
    const response = await GET()
    await expectJson(response, 500)
  })
})
