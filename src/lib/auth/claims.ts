export type TenantRole = "BARBERSHOP_OWNER" | "BARBER" | "ASSISTANT"
export type ProfessionalTenantRole = "BARBER" | "ASSISTANT"

export type SuperAdminSession = {
  type: "USER"
  userId: string
  globalRole: "SUPER_ADMIN"
  tenantRole: null
  barbershopId: null
  sessionVersion: number
}

export type TenantUserSession = {
  type: "USER"
  userId: string
  globalRole: null
  tenantRole: TenantRole
  barbershopId: string
  sessionVersion: number
}

export type ProfessionalSession = {
  type: "PROFESSIONAL"
  professionalId: string
  globalRole: null
  tenantRole: ProfessionalTenantRole
  barbershopId: string
  sessionVersion: number
}

export type Session =
  | SuperAdminSession
  | TenantUserSession
  | ProfessionalSession

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isSessionVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isTenantRole(value: unknown): value is TenantRole {
  return (
    value === "BARBERSHOP_OWNER" ||
    value === "BARBER" ||
    value === "ASSISTANT"
  )
}

function isProfessionalTenantRole(
  value: unknown
): value is ProfessionalTenantRole {
  return value === "BARBER" || value === "ASSISTANT"
}

export function isSessionPayload(value: unknown): value is Session {
  if (
    !isRecord(value) ||
    "role" in value ||
    !isSessionVersion(value.sessionVersion)
  ) {
    return false
  }

  if (value.type === "USER") {
    if ("professionalId" in value || !isNonEmptyString(value.userId)) {
      return false
    }

    if (value.globalRole === "SUPER_ADMIN") {
      return value.tenantRole === null && value.barbershopId === null
    }

    return (
      value.globalRole === null &&
      isTenantRole(value.tenantRole) &&
      isNonEmptyString(value.barbershopId)
    )
  }

  return (
    value.type === "PROFESSIONAL" &&
    !("userId" in value) &&
    isNonEmptyString(value.professionalId) &&
    value.globalRole === null &&
    isProfessionalTenantRole(value.tenantRole) &&
    isNonEmptyString(value.barbershopId)
  )
}
