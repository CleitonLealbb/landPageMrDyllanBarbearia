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
  | "barbershops:view"
  | "barbershops:create"
  | "barbershops:update"
  | "barbershops:delete"

const permissions: Record<Role, Permission[]> = {
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
  ],

  BARBER: [
    "professionals:view",
  ],

  ASSISTANT: [],
}

export function canAccess(
  role: string,
  permission: Permission
) {
  return permissions[role as Role]?.includes(permission) ?? false
}