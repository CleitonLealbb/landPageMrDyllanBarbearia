import jwt from "jsonwebtoken"
import { cookies } from "next/headers"

import { prisma } from "@/lib/prisma"

type TenantRole = "BARBERSHOP_OWNER" | "BARBER" | "ASSISTANT"
type ProfessionalTenantRole = "BARBER" | "ASSISTANT"

type SuperAdminSession = {
  type: "USER"
  userId: string
  globalRole: "SUPER_ADMIN"
  tenantRole: null
  barbershopId: null
  sessionVersion: number
}

type TenantUserSession = {
  type: "USER"
  userId: string
  globalRole: null
  tenantRole: TenantRole
  barbershopId: string
  sessionVersion: number
}

type ProfessionalSession = {
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

export type CurrentBarbershop = {
  id: string
  name?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isSessionVersion(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  )
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

function isSessionPayload(value: unknown): value is Session {
  if (
    !isRecord(value) ||
    "role" in value ||
    !isSessionVersion(value.sessionVersion)
  ) {
    return false
  }

  if (value.type === "USER") {
    if (
      "professionalId" in value ||
      !isNonEmptyString(value.userId)
    ) {
      return false
    }

    if (value.globalRole === "SUPER_ADMIN") {
      return (
        value.tenantRole === null &&
        value.barbershopId === null
      )
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

async function revalidateSession(
  session: Session
): Promise<Session | null> {
  if (session.type === "USER") {
    const user = await prisma.user.findUnique({
      where: {
        id: session.userId,
      },
      select: {
        role: true,
        sessionVersion: true,
      },
    })

    if (
      !user ||
      user.sessionVersion !== session.sessionVersion
    ) {
      return null
    }

    if (session.globalRole === "SUPER_ADMIN") {
      if (user.role !== "SUPER_ADMIN") {
        return null
      }

      return {
        type: "USER",
        userId: session.userId,
        globalRole: "SUPER_ADMIN",
        tenantRole: null,
        barbershopId: null,
        sessionVersion: session.sessionVersion,
      }
    }

    if (user.role !== session.tenantRole) {
      return null
    }

    const memberships = await prisma.barbershopUser.findMany({
      where: {
        userId: session.userId,
        barbershop: {
          status: "ACTIVE",
        },
      },
      select: {
        barbershopId: true,
        role: true,
      },
      take: 2,
    })

    if (memberships.length !== 1) {
      return null
    }

    const [membership] = memberships

    if (
      membership.barbershopId !== session.barbershopId ||
      membership.role !== session.tenantRole
    ) {
      return null
    }

    return {
      type: "USER",
      userId: session.userId,
      globalRole: null,
      tenantRole: session.tenantRole,
      barbershopId: session.barbershopId,
      sessionVersion: session.sessionVersion,
    }
  }

  const professional = await prisma.professional.findUnique({
    where: {
      id: session.professionalId,
    },
    select: {
      barbershopId: true,
      permissionLevel: true,
      sessionVersion: true,
      status: true,
    },
  })

  if (
    !professional ||
    professional.status !== "ACTIVE" ||
    professional.sessionVersion !== session.sessionVersion ||
    professional.permissionLevel !== session.tenantRole ||
    professional.barbershopId !== session.barbershopId
  ) {
    return null
  }

  const barbershop = await prisma.barbershop.findUnique({
    where: {
      id: session.barbershopId,
    },
    select: {
      status: true,
    },
  })

  if (!barbershop || barbershop.status !== "ACTIVE") {
    return null
  }

  return {
    type: "PROFESSIONAL",
    professionalId: session.professionalId,
    globalRole: null,
    tenantRole: session.tenantRole,
    barbershopId: session.barbershopId,
    sessionVersion: session.sessionVersion,
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) {
    return null
  }

  try {
    const decoded: unknown = jwt.verify(
      token,
      process.env.JWT_SECRET!
    )

    if (!isSessionPayload(decoded)) {
      return null
    }

    return await revalidateSession(decoded)
  } catch {
    return null
  }
}

export async function getCurrentBarbershop(): Promise<CurrentBarbershop | null> {
  const session = await getSession()

  if (!session || session.globalRole === "SUPER_ADMIN") {
    return null
  }

  const barbershop = await prisma.barbershop.findUnique({
    where: {
      id: session.barbershopId,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  })

  if (!barbershop || barbershop.status !== "ACTIVE") {
    return null
  }

  if (session.type === "PROFESSIONAL") {
    return {
      id: barbershop.id,
    }
  }

  return {
    id: barbershop.id,
    name: barbershop.name,
  }
}
