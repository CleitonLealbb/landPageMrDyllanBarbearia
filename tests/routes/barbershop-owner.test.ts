import { describe, expect, it, vi } from "vitest"

import { prismaMock } from "../setup/prisma-mock"
import { ownerSession, professionalBarberSession, superAdminSession } from "../setup/session-fixtures"
import { expectJson, expectNoSensitiveData, expectSanitizedInternalError, jsonRequest } from "../helpers/route-assertions"

const { getSessionMock, hashMock } = vi.hoisted(() => ({ getSessionMock: vi.fn(), hashMock: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }))
vi.mock("bcryptjs", () => ({ default: { hash: hashMock } }))

import { POST } from "@/app/api/barbershops/[id]/owner/route"

const context = { params: Promise.resolve({ id: "shop" }) }
const validBody = { name: " Owner ", email: " OWNER@Test.com ", password: "plain-password" }

describe("/api/barbershops/[id]/owner", () => {
  it.each([
    [null, 401],
    [ownerSession, 403],
    [professionalBarberSession, 403],
  ])("bloqueia identidade sem permissao", async (session, status) => {
    getSessionMock.mockResolvedValue(session)
    await expectJson(await POST(jsonRequest("http://test/x", "POST", validBody), context), status)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
    expect(hashMock).not.toHaveBeenCalled()
  })

  it("retorna 400 para entrada invalida", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    await expectJson(await POST(jsonRequest("http://test/x", "POST", { name: "Owner" }), context), 400)
    expect(prismaMock.barbershop.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 404 para barbearia inexistente", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.findUnique.mockResolvedValue(null)
    await expectJson(await POST(jsonRequest("http://test/x", "POST", validBody), context), 404)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it("retorna 409 para email duplicado", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.findUnique.mockResolvedValue({ id: "shop" })
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" })
    await expectJson(await POST(jsonRequest("http://test/x", "POST", validBody), context), 409)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it("cria owner e membership aninhada sem expor senha", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.findUnique.mockResolvedValue({ id: "shop" })
    prismaMock.user.findUnique.mockResolvedValue(null)
    hashMock.mockResolvedValue("hashed-password")
    prismaMock.user.create.mockResolvedValue({ id: "owner", name: "Owner", email: "owner@test.com", role: "BARBERSHOP_OWNER" })

    const body = await expectJson(await POST(jsonRequest("http://test/x", "POST", validBody), context), 200)
    expect(hashMock).toHaveBeenCalledWith("plain-password", 10)
    expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        role: "BARBERSHOP_OWNER",
        password: "hashed-password",
        memberships: { create: { barbershopId: "shop", role: "BARBERSHOP_OWNER" } },
      }),
      select: expect.not.objectContaining({ password: true }),
    }))
    expectNoSensitiveData(body)
    expect(JSON.stringify(body)).not.toContain("hashed-password")
  })

  it("retorna 500 sanitizado para erro interno", async () => {
    getSessionMock.mockResolvedValue(superAdminSession)
    prismaMock.barbershop.findUnique.mockRejectedValue(new Error("database secret"))
    const response = await POST(jsonRequest("http://test/x", "POST", validBody), context)
    expectSanitizedInternalError(await expectJson(response, 500))
  })
})
