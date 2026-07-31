import { describe, expect, it, vi } from "vitest"

import { prismaMock } from "../setup/prisma-mock"
import { ownerSession, professionalBarberSession, superAdminSession } from "../setup/session-fixtures"
import { expectJson, expectNoSensitiveData } from "../helpers/route-assertions"

const { getSessionMock, getCurrentBarbershopMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(), getCurrentBarbershopMock: vi.fn(),
}))
vi.mock("@/lib/auth/session", () => ({
  getSession: getSessionMock, getCurrentBarbershop: getCurrentBarbershopMock,
}))

import { GET } from "@/app/api/dashboard/summary/route"

describe("/api/dashboard/summary", () => {
  it("retorna 401 sem sessao e nao consulta Prisma", async () => {
    getSessionMock.mockResolvedValue(null)
    const body = await expectJson(await GET(), 401)
    expect(body).toEqual(expect.objectContaining({ message: expect.any(String) }))
    expect(prismaMock.barbershop.count).not.toHaveBeenCalled()
    expect(prismaMock.professional.count).not.toHaveBeenCalled()
  })

  it("SUPER_ADMIN recebe resumo global atual", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.count.mockResolvedValue(2)
    prismaMock.user.count.mockResolvedValue(3)
    prismaMock.professional.count.mockResolvedValue(4)
    const body = await expectJson(await GET(), 200)
    expect(body).toEqual({ role: "SUPER_ADMIN", barbershops: 2, owners: 3, professionals: 4, revenue: 0 })
    expect(getCurrentBarbershopMock).not.toHaveBeenCalled()
    expectNoSensitiveData(body)
  })

  it.each([ownerSession, professionalBarberSession])(
    "$type recebe resumo somente do tenant da sessao",
    async (session) => {
      getSessionMock.mockResolvedValue(session)
      getCurrentBarbershopMock.mockResolvedValue({ id: session.barbershopId, name: "One" })
      prismaMock.professional.count.mockResolvedValue(5)
      const body = await expectJson(await GET(), 200)
      expect(prismaMock.professional.count).toHaveBeenCalledWith({
        where: { barbershopId: session.barbershopId },
      })
      expect(body).toEqual(expect.objectContaining({
        barbershopId: session.barbershopId, role: session.tenantRole, professionals: 5,
      }))
      expectNoSensitiveData(body)
    }
  )

  it("barbearia nao validada retorna 404 sem query de negocio", async () => {
    getSessionMock.mockResolvedValue(ownerSession)
    getCurrentBarbershopMock.mockResolvedValue(null)
    await expectJson(await GET(), 404)
    expect(prismaMock.professional.count).not.toHaveBeenCalled()
  })

  it("nao aceita barbershopId do cliente porque o handler nao recebe Request", () => {
    expect(GET.length).toBe(0)
  })

  it.fails("documenta que falha interna ainda nao e sanitizada", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.count.mockRejectedValue(new Error("database secret"))
    prismaMock.user.count.mockResolvedValue(0)
    prismaMock.professional.count.mockResolvedValue(0)
    const response = await GET()
    await expectJson(response, 500)
  })
})
