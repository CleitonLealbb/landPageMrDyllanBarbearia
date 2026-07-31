import { describe, expect, it, vi } from "vitest"

import { prismaMock } from "../setup/prisma-mock"
import { ownerSession, professionalBarberSession, superAdminSession } from "../setup/session-fixtures"
import { expectJson, expectNoSensitiveData, jsonRequest } from "../helpers/route-assertions"

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

  it("documenta que id vazio segue para o Prisma sem validacao", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.update.mockResolvedValue({ id: "", name: "New" })
    await expectJson(await PUT(jsonRequest("http://test/x", "PUT", { name: "New" }), context("")), 200)
    expect(prismaMock.barbershop.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "" } }))
  })

  it("documenta que registro inexistente propaga erro Prisma", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.update.mockRejectedValue(new Error("not found"))
    await expect(PUT(jsonRequest("http://test/x", "PUT", {}), context("missing"))).rejects.toThrow("not found")
  })

  it.fails("documenta que erro interno de DELETE nao e sanitizado", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershopUser.count.mockRejectedValue(new Error("database secret"))
    prismaMock.professional.count.mockResolvedValue(0)
    const response = await DELETE(jsonRequest("http://test/x", "DELETE", {}), context("shop"))
    await expectJson(response, 500)
  })
})
