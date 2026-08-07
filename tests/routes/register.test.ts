import { describe, expect, it } from "vitest"

import {
  expectJson,
  expectNoSensitiveData,
  jsonRequest,
} from "../helpers/route-assertions"
import { prismaMock } from "../setup/prisma-mock"

import { POST } from "@/app/api/register/route"

describe("/api/register", () => {
  it.each([
    ["sem campos administrativos", {}],
    ["com papel global", { globalRole: "SUPER_ADMIN" }],
    ["com papel administrativo", { role: "BARBERSHOP_OWNER" }],
    ["com papel de tenant", { tenantRole: "BARBER" }],
    ["com tenant", { barbershopId: "attacker-controlled-tenant" }],
    ["com permissao profissional", { permissionLevel: "ASSISTANT" }],
  ])("rejeita cadastro publico %s sem criar identidade", async (_name, extraFields) => {
    const request = jsonRequest("http://test/api/register", "POST", {
      name: "Attacker",
      email: "attacker@test.com",
      password: "secret",
      ...extraFields,
    })
    const payload = await expectJson(await POST(request), 403)

    expect(payload).toEqual({ message: "Cadastro administrativo indisponivel." })
    expectNoSensitiveData(payload)
    expect(request.bodyUsed).toBe(false)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
    expect(prismaMock.professional.create).not.toHaveBeenCalled()
  })

  it("mantem erro sanitizado mesmo com corpo invalido", async () => {
    const request = new Request("http://test/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid-json",
    })
    const payload = await expectJson(await POST(request), 403)

    expect(payload).toEqual({ message: "Cadastro administrativo indisponivel." })
    expect(request.bodyUsed).toBe(false)
    expect(JSON.stringify(payload)).not.toContain("invalid-json")
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })
})
