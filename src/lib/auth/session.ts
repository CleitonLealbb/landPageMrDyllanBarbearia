import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

export type SessionRole =
  | "SUPER_ADMIN"
  | "BARBERSHOP_OWNER"
  | "BARBER"
  | "ASSISTANT"

export type SessionType = "USER" | "PROFESSIONAL"

export type Session = {
  userId: string
  role: SessionRole
  type: SessionType
}

export type CurrentBarbershop = {
  id: string
  name?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isUserRole(value: unknown): value is SessionRole {
  return (
    value === "SUPER_ADMIN" ||
    value === "BARBERSHOP_OWNER" ||
    value === "BARBER" ||
    value === "ASSISTANT"
  )
}

function isProfessionalRole(
  value: unknown
): value is "BARBER" | "ASSISTANT" {
  return value === "BARBER" || value === "ASSISTANT"
}

function isSessionPayload(value: unknown): value is Session {
  if (
    !isRecord(value) ||
    typeof value.userId !== "string" ||
    value.userId.trim().length === 0
  ) {
    return false
  }

  if (value.type === "USER") {
    return isUserRole(value.role)
  }

  if (value.type === "PROFESSIONAL") {
    return isProfessionalRole(value.role)
  }

  return false
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) return null

  try {
    const decoded: unknown = jwt.verify(
      token,
      process.env.JWT_SECRET!
    )

    if (!isSessionPayload(decoded)) {
      return null
    }

    return {
      userId: decoded.userId,
      role: decoded.role,
      type: decoded.type,
    }
  } catch {
    return null
  }
}

export async function getCurrentBarbershop(): Promise<CurrentBarbershop | null> {
  const session = await getSession()

  if (!session) {
    return null
  }

  if (
    session.type === "USER" &&
    session.role === "SUPER_ADMIN"
  ) {
    return null
  }

  if (session.type === "PROFESSIONAL") {
    const professional = await prisma.professional.findUnique({
      where: {
        id: session.userId,
      },
      select: {
        barbershopId: true,
        status: true,
        permissionLevel: true,
      },
    })

    if (
      !professional ||
      professional.status !== "ACTIVE" ||
      (professional.permissionLevel !== "BARBER" &&
        professional.permissionLevel !== "ASSISTANT") ||
      professional.permissionLevel !== session.role ||
      typeof professional.barbershopId !== "string" ||
      professional.barbershopId.trim().length === 0
    ) {
      return null
    }

    const barbershop = await prisma.barbershop.findUnique({
      where: {
        id: professional.barbershopId,
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!barbershop || barbershop.status !== "ACTIVE") {
      return null
    }

    return {
      id: barbershop.id,
    }
  }

  const memberships = await prisma.barbershopUser.findMany({
    where: {
      userId: session.userId,
      role: session.role,
    },
    select: {
      barbershop: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  })

  if (memberships.length !== 1) {
    return null
  }

  const [{ barbershop }] = memberships

  if (barbershop.status !== "ACTIVE") {
    return null
  }

  return {
    id: barbershop.id,
    name: barbershop.name,
  }
}
