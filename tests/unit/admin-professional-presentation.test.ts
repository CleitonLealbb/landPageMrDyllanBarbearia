import { describe, expect, it } from "vitest"

import {
  adminProfessionalSelect,
  presentAdminProfessional,
} from "@/lib/professionals/admin-presentation"

const base = {
  id: "professional",
  name: "Professional",
  email: null,
  role: "Barbeiro",
  permissionLevel: "BARBER" as const,
  commission: 65,
  specialties: [],
  photoUrl: null,
  status: "ACTIVE",
}

describe("apresentacao administrativa de Professional", () => {
  it("deriva o e-mail do User para perfil vinculado sem expor a relacao", () => {
    const result = presentAdminProfessional({
      ...base,
      membership: { user: { email: "owner@example.test" } },
    })

    expect(result).toEqual(expect.objectContaining({
      email: null,
      accessEmail: "owner@example.test",
      identityType: "LINKED_USER",
    }))
    expect(result).not.toHaveProperty("membership")
    expect(result).not.toHaveProperty("userId")
    expect(adminProfessionalSelect).not.toHaveProperty("userId")
  })

  it("preserva o e-mail editavel do profissional independente", () => {
    const result = presentAdminProfessional({
      ...base,
      email: "professional@example.test",
      membership: null,
    })
    expect(result).toEqual(expect.objectContaining({
      email: "professional@example.test",
      accessEmail: "professional@example.test",
      identityType: "INDEPENDENT_PROFESSIONAL",
    }))
  })
})
