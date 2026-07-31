import { beforeEach, describe, expect, it, vi } from "vitest"

import { prismaMock } from "../setup/prisma-mock"
import { ownerSession, professionalBarberSession, superAdminSession } from "../setup/session-fixtures"
import { expectJson, expectNoSensitiveData, jsonRequest } from "../helpers/route-assertions"

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ getSession: getSessionMock }))

import { GET, POST } from "@/app/api/barbershops/route"

function expectNoBarbershopPrisma() {
  expect(prismaMock.barbershop.findMany).not.toHaveBeenCalled()
  expect(prismaMock.barbershop.create).not.toHaveBeenCalled()
}

describe("/api/barbershops", () => {
  beforeEach(() => getSessionMock.mockResolvedValue(superAdminSession))

  it.each([
    ["sem sessao", null, 401],
    ["USER tenant", ownerSession, 403],
    ["PROFESSIONAL", professionalBarberSession, 403],
  ])("GET bloqueia %s", async (_name, session, status) => {
    getSessionMock.mockResolvedValue(session)
    const body = await expectJson(await GET(), status)
    expect(body).toEqual(expect.objectContaining({ message: expect.any(String) }))
    expectNoBarbershopPrisma()
  })

  it("GET permite SUPER_ADMIN e retorna dados publicos", async () => {
    const rows = [{ id: "shop", name: "One", status: "ACTIVE", members: [] }]
    prismaMock.barbershop.findMany.mockResolvedValue(rows)
    const responseBody = await expectJson(await GET(), 200)
    expect(responseBody).toEqual(rows)
    expectNoSensitiveData(responseBody)
  })

  it.each([
    ["sem sessao", null, 401],
    ["USER tenant", ownerSession, 403],
    ["PROFESSIONAL", professionalBarberSession, 403],
  ])("POST bloqueia %s", async (_name, session, status) => {
    getSessionMock.mockResolvedValue(session)
    const response = await POST(jsonRequest("http://test/api/barbershops", "POST", { name: "One" }))
    expect(await expectJson(response, status)).toEqual(
      expect.objectContaining({ message: expect.any(String) })
    )
    expectNoBarbershopPrisma()
  })

  it("POST invalido retorna 400 sem criar", async () => {
    const response = await POST(jsonRequest("http://test/api/barbershops", "POST", {}))
    await expectJson(response, 400)
    expect(prismaMock.barbershop.create).not.toHaveBeenCalled()
  })

  it("POST usa somente campos permitidos", async () => {
    const created = { id: "shop", name: "One", status: "ACTIVE" }
    prismaMock.barbershop.create.mockResolvedValue(created)
    const response = await POST(
      jsonRequest("http://test/api/barbershops", "POST", {
        name: "  One  ", phone: "1", email: "one@test", address: "Street", status: "INACTIVE",
        password: "must-not-pass",
      })
    )
    const body = await expectJson(response, 200)
    expect(prismaMock.barbershop.create).toHaveBeenCalledWith({
      data: { name: "One", phone: "1", email: "one@test", address: "Street" },
    })
    expectNoSensitiveData(body)
  })

  it.fails("documenta que falha interna ainda nao e sanitizada", async () => {
    prismaMock.barbershop.findMany.mockRejectedValue(new Error("database secret"))
    const response = await GET()
    const body = await expectJson(response, 500)
    expect(JSON.stringify(body)).not.toContain("database secret")
  })
})
