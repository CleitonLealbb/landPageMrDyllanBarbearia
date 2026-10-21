import jwt from "jsonwebtoken"
import { cookies } from "next/headers"

import { prisma } from "@/lib/prisma"
import { isSessionPayload } from "@/lib/auth/claims"
import type { Session } from "@/lib/auth/claims"

export type { Session } from "@/lib/auth/claims"

export type CurrentBarbershop = {
  id: string
  name?: string
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
      userId: true,
      barbershopId: true,
      permissionLevel: true,
      sessionVersion: true,
      status: true,
    },
  })

  if (
    !professional ||
    professional.userId !== null ||
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
