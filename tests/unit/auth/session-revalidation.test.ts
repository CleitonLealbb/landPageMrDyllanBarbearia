import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProfessionalSession } from "@/lib/auth/claims"

import { prismaMock } from "../../setup/prisma-mock"
import {
  ownerSession,
  professionalAssistantSession,
  professionalBarberSession,
  superAdminSession,
} from "../../setup/session-fixtures"

const { cookiesMock, verifyMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  verifyMock: vi.fn(),
}))

vi.mock("next/headers", () => ({ cookies: cookiesMock }))
vi.mock("jsonwebtoken", () => ({
  default: { verify: verifyMock },
}))

import { getCurrentBarbershop, getSession } from "@/lib/auth/session"

function setCookie(token?: string) {
  cookiesMock.mockResolvedValue({
    get: vi.fn(() => (token ? { value: token } : undefined)),
  })
}

function decode(payload: unknown) {
  setCookie("mock-token")
  verifyMock.mockReturnValue(payload)
}

function validUser(role: string, sessionVersion: number) {
  prismaMock.user.findUnique.mockResolvedValue({ role, sessionVersion })
}

function validMembership(role = "BARBERSHOP_OWNER", barbershopId = "barbershop-one") {
  prismaMock.barbershopUser.findMany.mockResolvedValue([{ role, barbershopId }])
}

function validProfessional(
  session: ProfessionalSession = professionalBarberSession,
  overrides: Record<string, unknown> = {}
) {
  prismaMock.professional.findUnique.mockResolvedValue({
    userId: null,
    barbershopId: session.barbershopId,
    permissionLevel: session.tenantRole,
    sessionVersion: session.sessionVersion,
    status: "ACTIVE",
    ...overrides,
  })
  prismaMock.barbershop.findUnique.mockResolvedValue({ status: "ACTIVE" })
}

function expectNoPrismaCalls() {
  expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  expect(prismaMock.professional.findUnique).not.toHaveBeenCalled()
  expect(prismaMock.barbershopUser.findMany).not.toHaveBeenCalled()
  expect(prismaMock.barbershop.findUnique).not.toHaveBeenCalled()
}

beforeEach(() => {
  setCookie("mock-token")
})

describe("getSession - token e claims", () => {
  it("retorna null sem cookie e nao verifica JWT ou Prisma", async () => {
    setCookie()

    await expect(getSession()).resolves.toBeNull()
    expect(verifyMock).not.toHaveBeenCalled()
    expectNoPrismaCalls()
  })

  it.each(["token invalido", "token expirado", "assinatura invalida"])(
    "rejeita %s sem consultar Prisma",
    async () => {
      verifyMock.mockImplementation(() => {
        throw new Error("JWT rejected")
      })

      await expect(getSession()).resolves.toBeNull()
      expectNoPrismaCalls()
    }
  )

  it.each([
    ["token legado", { ...ownerSession, role: "BARBERSHOP_OWNER" }],
    ["SUPER_ADMIN com tenant", { ...superAdminSession, tenantRole: "BARBER" }],
    ["identidade cruzada", { ...ownerSession, professionalId: "professional" }],
  ])("rejeita %s antes do Prisma", async (_name, claims) => {
    decode(claims)

    await expect(getSession()).resolves.toBeNull()
    expectNoPrismaCalls()
  })
})

describe("getSession - SUPER_ADMIN", () => {
  beforeEach(() => decode(superAdminSession))

  it("revalida uma sessao valida", async () => {
    validUser("SUPER_ADMIN", superAdminSession.sessionVersion)
    await expect(getSession()).resolves.toEqual(superAdminSession)
  })

  it.each([
    ["usuario inexistente", null],
    ["sessionVersion divergente", { role: "SUPER_ADMIN", sessionVersion: 99 }],
    ["papel alterado", { role: "BARBERSHOP_OWNER", sessionVersion: 3 }],
  ])("rejeita %s", async (_name, user) => {
    prismaMock.user.findUnique.mockResolvedValue(user)
    await expect(getSession()).resolves.toBeNull()
    expect(prismaMock.barbershopUser.findMany).not.toHaveBeenCalled()
  })
})

describe("getSession - USER tenant", () => {
  beforeEach(() => decode(ownerSession))

  it("revalida owner com membership unica e ativa", async () => {
    validUser("BARBERSHOP_OWNER", ownerSession.sessionVersion)
    validMembership()

    await expect(getSession()).resolves.toEqual(ownerSession)
    expect(prismaMock.barbershopUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: ownerSession.userId,
          barbershop: { status: "ACTIVE" },
        },
        take: 2,
      })
    )
  })

  it.each([
    ["usuario inexistente", null],
    ["sessionVersion divergente", { role: "BARBERSHOP_OWNER", sessionVersion: 99 }],
    ["papel incompatível", { role: "BARBER", sessionVersion: 4 }],
  ])("rejeita %s antes da membership", async (_name, user) => {
    prismaMock.user.findUnique.mockResolvedValue(user)
    await expect(getSession()).resolves.toBeNull()
    expect(prismaMock.barbershopUser.findMany).not.toHaveBeenCalled()
  })

  it.each([
    ["membership ausente", []],
    [
      "mais de uma membership ativa",
      [
        { role: "BARBERSHOP_OWNER", barbershopId: "barbershop-one" },
        { role: "BARBERSHOP_OWNER", barbershopId: "barbershop-two" },
      ],
    ],
    ["membership de outra barbearia", [{ role: "BARBERSHOP_OWNER", barbershopId: "other" }]],
    ["papel da membership incompatível", [{ role: "BARBER", barbershopId: "barbershop-one" }]],
  ])("rejeita %s", async (_name, memberships) => {
    validUser("BARBERSHOP_OWNER", ownerSession.sessionVersion)
    prismaMock.barbershopUser.findMany.mockResolvedValue(memberships)
    await expect(getSession()).resolves.toBeNull()
  })

  it.each(["barbearia inativa", "barbearia inexistente"])(
    "rejeita %s quando o filtro de memberships ativas nao encontra vinculo",
    async () => {
      validUser("BARBERSHOP_OWNER", ownerSession.sessionVersion)
      prismaMock.barbershopUser.findMany.mockResolvedValue([])
      await expect(getSession()).resolves.toBeNull()
      expect(prismaMock.barbershopUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ barbershop: { status: "ACTIVE" } }) })
      )
    }
  )
})

describe("getSession - PROFESSIONAL", () => {
  it.each([professionalBarberSession, professionalAssistantSession])(
    "revalida $tenantRole ativo",
    async (session) => {
      decode(session)
      validProfessional(session)
      await expect(getSession()).resolves.toEqual(session)
    }
  )

  it.each([
    ["profissional inexistente", null],
    ["profissional pendente", { status: "PENDING" }],
    ["profissional inativo", { status: "INACTIVE" }],
    ["sessionVersion divergente", { sessionVersion: 99 }],
    ["permissionLevel alterado", { permissionLevel: "ASSISTANT" }],
    ["barbershopId divergente", { barbershopId: "other" }],
  ])("rejeita %s", async (_name, professional) => {
    decode(professionalBarberSession)
    if (professional === null) {
      prismaMock.professional.findUnique.mockResolvedValue(null)
    } else {
      validProfessional(professionalBarberSession, professional)
    }

    await expect(getSession()).resolves.toBeNull()
    expect(prismaMock.barbershop.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    ["barbearia inexistente", null],
    ["barbearia inativa", { status: "INACTIVE" }],
  ])("rejeita %s", async (_name, barbershop) => {
    decode(professionalBarberSession)
    validProfessional()
    prismaMock.barbershop.findUnique.mockResolvedValue(barbershop)
    await expect(getSession()).resolves.toBeNull()
  })
})

describe("getCurrentBarbershop", () => {
  it("retorna null sem sessao", async () => {
    setCookie()
    await expect(getCurrentBarbershop()).resolves.toBeNull()
    expect(prismaMock.barbershop.findUnique).not.toHaveBeenCalled()
  })

  it("retorna null para SUPER_ADMIN sem buscar barbearia", async () => {
    decode(superAdminSession)
    validUser("SUPER_ADMIN", superAdminSession.sessionVersion)
    await expect(getCurrentBarbershop()).resolves.toBeNull()
    expect(prismaMock.barbershop.findUnique).not.toHaveBeenCalled()
  })

  it("retorna id e nome para USER tenant usando o id validado", async () => {
    decode(ownerSession)
    validUser("BARBERSHOP_OWNER", ownerSession.sessionVersion)
    validMembership()
    prismaMock.barbershop.findUnique.mockResolvedValue({
      id: ownerSession.barbershopId,
      name: "Barbearia One",
      status: "ACTIVE",
    })

    await expect(getCurrentBarbershop()).resolves.toEqual({
      id: ownerSession.barbershopId,
      name: "Barbearia One",
    })
    expect(prismaMock.barbershop.findUnique).toHaveBeenCalledWith({
      where: { id: ownerSession.barbershopId },
      select: { id: true, name: true, status: true },
    })
    expect(prismaMock.barbershop.findFirst).not.toHaveBeenCalled()
  })

  it("retorna somente id para PROFESSIONAL", async () => {
    decode(professionalBarberSession)
    prismaMock.professional.findUnique.mockResolvedValue({
      userId: null,
      barbershopId: professionalBarberSession.barbershopId,
      permissionLevel: "BARBER",
      sessionVersion: professionalBarberSession.sessionVersion,
      status: "ACTIVE",
    })
    prismaMock.barbershop.findUnique
      .mockResolvedValueOnce({ status: "ACTIVE" })
      .mockResolvedValueOnce({
        id: professionalBarberSession.barbershopId,
        name: "Barbearia One",
        status: "ACTIVE",
      })

    await expect(getCurrentBarbershop()).resolves.toEqual({
      id: professionalBarberSession.barbershopId,
    })
    expect(prismaMock.barbershop.findFirst).not.toHaveBeenCalled()
  })

  it.each([
    ["inexistente", null],
    ["inativa", { id: ownerSession.barbershopId, name: "One", status: "INACTIVE" }],
  ])("retorna null para barbearia %s", async (_name, barbershop) => {
    decode(ownerSession)
    validUser("BARBERSHOP_OWNER", ownerSession.sessionVersion)
    validMembership()
    prismaMock.barbershop.findUnique.mockResolvedValue(barbershop)
    await expect(getCurrentBarbershop()).resolves.toBeNull()
  })
})
