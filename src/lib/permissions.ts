export type Role =
  | "SUPER_ADMIN"
  | "BARBERSHOP_OWNER"
  | "BARBER"
  | "ASSISTANT"

type Permission =
  | "professionals:view"
  | "professionals:create"
  | "professionals:update"
  | "professionals:delete"
  | "services:view"
  | "services:create"
  | "services:update"
  | "barbershops:view"
  | "barbershops:create"
  | "barbershops:update"
  | "barbershops:delete"

const permissions: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: [
    "barbershops:view",
    "barbershops:create",
    "barbershops:update",
    "barbershops:delete",
  ],

  BARBERSHOP_OWNER: [
    "professionals:view",
    "professionals:create",
    "professionals:update",
    "professionals:delete",
    "services:view",
    "services:create",
    "services:update",
  ],

  BARBER: [],

  ASSISTANT: [],
}

function isRole(value: unknown): value is Role {
  return (
    value === "SUPER_ADMIN" ||
    value === "BARBERSHOP_OWNER" ||
    value === "BARBER" ||
    value === "ASSISTANT"
  )
}

export function canAccess(
  role: unknown,
  permission: Permission
): boolean {
  if (!isRole(role)) {
    return false
  }

  return permissions[role].includes(permission)
}
