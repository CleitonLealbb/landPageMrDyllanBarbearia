import { describe, expect, it, vi } from "vitest"

import { prismaMock } from "../setup/prisma-mock"
import { expectJson, jsonRequest } from "../helpers/route-assertions"

const { compareMock, signMock } = vi.hoisted(() => ({
  compareMock: vi.fn(),
  signMock: vi.fn(),
}))
vi.mock("bcryptjs", () => ({ default: { compare: compareMock } }))
vi.mock("jsonwebtoken", () => ({ default: { sign: signMock } }))

import { POST } from "@/app/api/login/route"

describe("login de Professional inativo", () => {
  it("rejeita autenticacao e nao emite sessao", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.professional.findUnique.mockResolvedValue({
      id: "professional",
      userId: null,
      barbershopId: "shop",
      name: "Professional",
      email: "professional@example.test",
      password: "hash",
      photoUrl: null,
      permissionLevel: "BARBER",
      sessionVersion: 3,
      status: "INACTIVE",
    })
    compareMock.mockResolvedValue(true)

    const response = await POST(jsonRequest("http://test/api/login", "POST", {
      email: "professional@example.test",
      password: "valid-password",
    }))
    await expectJson(response, 403)
    expect(prismaMock.barbershop.findUnique).not.toHaveBeenCalled()
    expect(signMock).not.toHaveBeenCalled()
  })
})
