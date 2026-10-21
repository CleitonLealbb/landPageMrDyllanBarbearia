import { describe, expect, it } from "vitest"

import { canAccess } from "@/lib/permissions"

const permissions = [
  "professionals:view",
  "professionals:create",
  "professionals:update",
  "professionals:delete",
  "services:view",
  "services:create",
  "services:update",
  "settings:view",
  "barbershops:view",
  "barbershops:create",
  "barbershops:update",
  "barbershops:delete",
] as const

const expectedByRole = {
  SUPER_ADMIN: new Set(permissions.filter((permission) => permission.startsWith("barbershops:"))),
  BARBERSHOP_OWNER: new Set(
    permissions.filter((permission) => permission.startsWith("professionals:") || permission.startsWith("services:") || permission === "settings:view")
  ),
  BARBER: new Set<string>(),
  ASSISTANT: new Set<string>(),
} as const

describe("canAccess", () => {
  for (const [role, grantedPermissions] of Object.entries(expectedByRole)) {
    for (const permission of permissions) {
      it(`${role} ${grantedPermissions.has(permission) ? "pode" : "nao pode"} ${permission}`, () => {
        expect(canAccess(role, permission)).toBe(grantedPermissions.has(permission))
      })
    }
  }

  it.each([null, undefined, "UNKNOWN", {}, []])(
    "rejeita papel desconhecido em runtime: %j",
    (role) => {
      for (const permission of permissions) {
        expect(canAccess(role, permission)).toBe(false)
      }
    }
  )
})
