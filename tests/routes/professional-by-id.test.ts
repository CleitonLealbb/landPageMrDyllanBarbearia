import { beforeEach, describe, expect, it, vi } from "vitest"

import { prismaMock } from "../setup/prisma-mock"
import {
  ownerSession,
  professionalAssistantSession,
  professionalBarberSession,
  superAdminSession,
} from "../setup/session-fixtures"
import { expectJson, expectNoSensitiveData, expectSanitizedInternalError, jsonRequest } from "../helpers/route-assertions"

const { getSessionMock, getCurrentBarbershopMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(), getCurrentBarbershopMock: vi.fn(),
}))
vi.mock("@/lib/auth/session", () => ({
  getSession: getSessionMock, getCurrentBarbershop: getCurrentBarbershopMock,
}))

import { DELETE, PUT } from "@/app/api/professionals/[id]/route"

const context = (id: string) => ({ params: Promise.resolve({ id }) })
const userBarber = { ...ownerSession, tenantRole: "BARBER" } as const
const userAssistant = { ...ownerSession, tenantRole: "ASSISTANT" } as const
const existing = {
  id: "professional", barbershopId: ownerSession.barbershopId, name: "Old", email: "old@test.com", permissionLevel: "BARBER",
}
const updateBody = {
  name: "New", email: "new@test.com", role: "Barbeiro", permissionLevel: "BARBER",
  commission: 50, specialties: ["Corte"], photoUrl: "https://images.test/new.jpg",
}

function allowOwner() {
  getSessionMock.mockResolvedValue(ownerSession)
  getCurrentBarbershopMock.mockResolvedValue({ id: ownerSession.barbershopId, name: "One" })
  prismaMock.barbershopUser.findFirst.mockResolvedValue({ id: "membership" })
  prismaMock.user.findUnique.mockResolvedValue(null)
}

describe("/api/professionals/[id]", () => {
  beforeEach(allowOwner)

  it.each([PUT, DELETE])("%s retorna 401 sem sessao e nao muta", async (handler) => {
    getSessionMock.mockResolvedValue(null)
    const method = handler === PUT ? "PUT" : "DELETE"
    await expectJson(await handler(jsonRequest("http://test/x", method, updateBody), context("professional")), 401)
    expect(prismaMock.professional.update).not.toHaveBeenCalled()
    expect(prismaMock.professional.delete).not.toHaveBeenCalled()
  })

  it.each([superAdminSession, userBarber, userAssistant, professionalBarberSession, professionalAssistantSession])(
    "PUT e DELETE retornam 403 para $type/$tenantRole",
    async (session) => {
      getSessionMock.mockResolvedValue(session)
      await expectJson(await PUT(jsonRequest("http://test/x", "PUT", updateBody), context("professional")), 403)
      await expectJson(await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("professional")), 403)
      expect(prismaMock.professional.update).not.toHaveBeenCalled()
      expect(prismaMock.professional.delete).not.toHaveBeenCalled()
    }
  )

  it("owner sem membership retorna 403", async () => {
    prismaMock.barbershopUser.findFirst.mockResolvedValue(null)
    await expectJson(await PUT(jsonRequest("http://test/x", "PUT", updateBody), context("professional")), 403)
    expect(prismaMock.professional.findFirst).not.toHaveBeenCalled()
  })

  it.each([PUT, DELETE])("%s isola recurso por id e barbershopId", async (handler) => {
    prismaMock.professional.findFirst.mockResolvedValue(null)
    const method = handler === PUT ? "PUT" : "DELETE"
    await expectJson(await handler(jsonRequest("http://test/x", method, updateBody), context("other-tenant-pro")), 404)
    expect(prismaMock.professional.findFirst).toHaveBeenCalledWith({
      where: { id: "other-tenant-pro", barbershopId: ownerSession.barbershopId },
    })
    expect(prismaMock.professional.update).not.toHaveBeenCalled()
    expect(prismaMock.professional.delete).not.toHaveBeenCalled()
  })

  it("PUT incrementa sessionVersion quando permissionLevel muda", async () => {
    prismaMock.professional.findFirst.mockResolvedValue(existing)
    prismaMock.professional.update.mockResolvedValue({ ...existing, permissionLevel: "ASSISTANT" })
    const body = await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", { ...updateBody, permissionLevel: "ASSISTANT" }), context("professional")),
      200
    )
    expect(prismaMock.professional.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "professional" }, data: expect.objectContaining({ sessionVersion: { increment: 1 } }),
    }))
    expectNoSensitiveData(body)
  })

  it("PUT nao incrementa versao quando permissionLevel permanece igual", async () => {
    prismaMock.professional.findFirst.mockResolvedValue(existing)
    prismaMock.professional.update.mockResolvedValue({ ...existing, ...updateBody })
    await expectJson(await PUT(jsonRequest("http://test/x", "PUT", updateBody), context("professional")), 200)
    const call = prismaMock.professional.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data).not.toHaveProperty("sessionVersion")
  })

  it("PUT nao incrementa versao por mudancas de perfil", async () => {
    prismaMock.professional.findFirst.mockResolvedValue(existing)
    prismaMock.professional.update.mockResolvedValue({ ...existing, ...updateBody })
    await PUT(jsonRequest("http://test/x", "PUT", updateBody), context("professional"))
    expect(prismaMock.professional.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ sessionVersion: expect.anything() }),
    }))
  })

  it("PUT rejeita email para perfil vinculado sem alterar User ou Professional", async () => {
    prismaMock.professional.findFirst.mockResolvedValue({ ...existing, userId: "linked-user", email: null })
    const body = await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", updateBody), context("professional")),
      400
    )
    expect(body).toEqual({ message: expect.any(String) })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.professional.update).not.toHaveBeenCalled()
  })

  it("PUT rejeita tentativa de alterar permissionLevel do perfil vinculado", async () => {
    prismaMock.professional.findFirst.mockResolvedValue({ ...existing, userId: "linked-user", email: null })
    const { email: _email, ...payload } = updateBody
    await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", { ...payload, permissionLevel: "ASSISTANT" }), context("professional")),
      400
    )
    expect(prismaMock.professional.update).not.toHaveBeenCalled()
  })

  it("PUT preserva acesso BARBER e atualiza campos operacionais do perfil vinculado", async () => {
    const linked = { ...existing, userId: "linked-user", email: null, permissionLevel: "BARBER" }
    prismaMock.professional.findFirst.mockResolvedValue(linked)
    prismaMock.professional.update.mockResolvedValue({
      ...linked,
      name: "New",
      role: "Barbeiro Proprietário",
      commission: 65,
      specialties: ["Corte"],
      photoUrl: null,
      membership: { user: { email: "owner@example.test" } },
    })
    const body = await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", {
        name: "New", role: "Barbeiro Proprietário", commission: 65,
        specialties: ["Corte"], photoUrl: null,
      }), context("professional")),
      200
    )
    const call = prismaMock.professional.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data).toEqual(expect.objectContaining({
      name: "New", role: "Barbeiro Proprietário", commission: 65,
      specialties: ["Corte"], photoUrl: null,
    }))
    expect(call.data).not.toHaveProperty("permissionLevel")
    expect(call.data).not.toHaveProperty("email")
    expect(body).toEqual(expect.objectContaining({ identityType: "LINKED_USER" }))
  })

  it("DELETE exclui owner valido do mesmo tenant", async () => {
    prismaMock.professional.findFirst.mockResolvedValue(existing)
    prismaMock.professional.delete.mockResolvedValue(existing)
    await expectJson(await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("professional")), 200)
    expect(prismaMock.professional.delete).toHaveBeenCalledWith({ where: { id: "professional" } })
  })

  it("DELETE bloqueia exclusao fisica do perfil vinculado", async () => {
    prismaMock.professional.findFirst.mockResolvedValue({ ...existing, userId: "linked-user" })
    await expectJson(await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("professional")), 400)
    expect(prismaMock.professional.delete).not.toHaveBeenCalled()
  })

  it.each([PUT, DELETE])("%s retorna 404 sanitizado para P2025", async (handler) => {
    prismaMock.professional.findFirst.mockResolvedValue(existing)
    prismaMock.professional.update.mockRejectedValue({ code: "P2025", message: "database secret" })
    prismaMock.professional.delete.mockRejectedValue({ code: "P2025", message: "database secret" })
    const method = handler === PUT ? "PUT" : "DELETE"
    const body = await expectJson(
      await handler(jsonRequest("http://test/x", method, updateBody), context("professional")), 404
    )
    expect(body).toEqual({ message: expect.any(String) })
    expect(JSON.stringify(body)).not.toContain("P2025")
    expect(JSON.stringify(body)).not.toContain("database secret")
  })

  it("retorna 500 sanitizado para erro interno", async () => {
    prismaMock.professional.findFirst.mockRejectedValue(new Error("database secret"))
    const response = await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("professional"))
    expectSanitizedInternalError(await expectJson(response, 500))
  })
})
