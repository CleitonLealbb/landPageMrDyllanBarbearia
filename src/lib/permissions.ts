export type Role = "OWNER" | "BARBER" | "ASSISTANT"

export type Permission =
  | "professionals:view"
  | "professionals:create"
  | "professionals:update"
  | "professionals:delete"
  | "schedule:view_all"
  | "schedule:view_own"
  | "clients:view"
  | "clients:create"
  | "financial:view"
  | "reports:view"

const permissions: Record<Role, Permission[]> = {
  OWNER: [
    "professionals:view",
    "professionals:create",
    "professionals:update",
    "professionals:delete",
    "schedule:view_all",
    "clients:view",
    "clients:create",
    "financial:view",
    "reports:view",
  ],

  BARBER: [
    "schedule:view_own",
    "clients:view",
  ],

  ASSISTANT: [
    "schedule:view_all",
    "clients:view",
    "clients:create",
  ],
}

export function canAccess(
  role: string | undefined,
  permission: Permission
) {
  if (!role) return false

  return permissions[role as Role]?.includes(permission) ?? false
}