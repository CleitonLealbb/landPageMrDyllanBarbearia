import { describe, expect, it, vi } from "vitest"

import { prismaMock } from "../setup/prisma-mock"
import { ownerSession, professionalBarberSession, superAdminSession } from "../setup/session-fixtures"
import { expectJson, expectNoSensitiveData, expectSanitizedInternalError, jsonRequest } from "../helpers/route-assertions"

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }))

import { DELETE, PUT } from "@/app/api/barbershops/[id]/route"

const context = (id: string) => ({ params: Promise.resolve({ id }) })

describe("/api/barbershops/[id]", () => {
  it.each([PUT, DELETE])("%s retorna 401 sem sessao e nao muta", async (handler) => {
    getSessionMock.mockResolvedValue(null)
    const response = await handler(
      jsonRequest("http://test/api/barbershops/shop", handler === PUT ? "PUT" : "DELETE", {}),
      context("shop")
    )
    await expectJson(response, 401)
    expect(prismaMock.barbershop.update).not.toHaveBeenCalled()
    expect(prismaMock.barbershop.delete).not.toHaveBeenCalled()
  })

  it.each([ownerSession, professionalBarberSession])(
    "PUT e DELETE retornam 403 para $type/$tenantRole",
    async (session) => {
      getSessionMock.mockResolvedValue(session)
      await expectJson(await PUT(jsonRequest("http://test/x", "PUT", {}), context("shop")), 403)
      await expectJson(await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("shop")), 403)
      expect(prismaMock.barbershop.update).not.toHaveBeenCalled()
      expect(prismaMock.barbershop.delete).not.toHaveBeenCalled()
    }
  )

  it("PUT permite SUPER_ADMIN", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.update.mockResolvedValue({ id: "shop", name: "New", status: "ACTIVE" })
    const body = await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", { name: " New ", status: "ACTIVE" }), context("shop")),
      200
    )
    expect(prismaMock.barbershop.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "shop" }, data: expect.objectContaining({ name: "New" }) })
    )
    expectNoSensitiveData(body)
  })

  it("DELETE permite SUPER_ADMIN quando nao ha vinculos", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershopUser.count.mockResolvedValue(0)
    prismaMock.professional.count.mockResolvedValue(0)
    prismaMock.barbershop.delete.mockResolvedValue({ id: "shop" })
    await expectJson(await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("shop")), 200)
    expect(prismaMock.barbershop.delete).toHaveBeenCalledWith({ where: { id: "shop" } })
  })

  it("DELETE retorna 409 e nao exclui quando existem vinculos", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershopUser.count.mockResolvedValue(1)
    prismaMock.professional.count.mockResolvedValue(0)
    await expectJson(await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("shop")), 409)
    expect(prismaMock.barbershop.delete).not.toHaveBeenCalled()
  })

  it.each([PUT, DELETE])("%s retorna 400 para ids invalidos sem consultar Prisma", async (handler) => {
    getSessionMock.mockResolvedValue(superAdminSession)
    for (const id of [undefined, null, 42, "", "  "]) {
      // @ts-expect-error Simula parametros de rota malformados em runtime.
      const malformedContext: Parameters<typeof handler>[1] = { params: Promise.resolve({ id }) }
      const method = handler === PUT ? "PUT" : "DELETE"
      await expectJson(
        await handler(jsonRequest("http://test/x", method, { name: "New" }), malformedContext),
        400
      )
      expect(prismaMock.barbershop.update).not.toHaveBeenCalled()
      expect(prismaMock.barbershopUser.count).not.toHaveBeenCalled()
      expect(prismaMock.professional.count).not.toHaveBeenCalled()
      expect(prismaMock.barbershop.delete).not.toHaveBeenCalled()
    }
  })

  it("retorna 404 controlado para registro inexistente", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.update.mockRejectedValue({ code: "P2025", message: "database secret" })
    const body = await expectJson(
      await PUT(jsonRequest("http://test/x", "PUT", {}), context("missing")), 404
    )
    expect(body).toEqual({ message: expect.any(String) })
    expect(JSON.stringify(body)).not.toContain("P2025")
    expect(JSON.stringify(body)).not.toContain("database secret")
  })

  it("retorna 404 controlado quando DELETE recebe P2025", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershopUser.count.mockResolvedValue(0)
    prismaMock.professional.count.mockResolvedValue(0)
    prismaMock.barbershop.delete.mockRejectedValue({ code: "P2025", message: "database secret" })
    const body = await expectJson(
      await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("missing")), 404
    )
    expect(JSON.stringify(body)).not.toContain("P2025")
    expect(JSON.stringify(body)).not.toContain("database secret")
  })

  it("retorna 500 sanitizado para erro interno de DELETE", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershopUser.count.mockRejectedValue(new Error("database secret"))
    prismaMock.professional.count.mockResolvedValue(0)
    const response = await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("shop"))
    expectSanitizedInternalError(await expectJson(response, 500))
  })
})
