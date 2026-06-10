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

type TokenPayload = Session & {
  iat?: number
  exp?: number
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) return null

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as TokenPayload

    return {
      userId: payload.userId,
      role: payload.role,
      type: payload.type,
    }
  } catch {
    return null
  }
}

export async function getCurrentBarbershop(): Promise<CurrentBarbershop | null> {
  const session = await getSession()

  if (!session || session.role === "SUPER_ADMIN") {
    return null
  }

  if (session.type === "PROFESSIONAL") {
    const professional = await prisma.professional.findUnique({
      where: {
        id: session.userId,
      },
      select: {
        barbershopId: true,
      },
    })

    if (!professional) return null

    return {
      id: professional.barbershopId,
    }
  }

  const membership = await prisma.barbershopUser.findFirst({
    where: {
      userId: session.userId,
    },
    include: {
      barbershop: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!membership) return null

  return {
    id: membership.barbershopId,
    name: membership.barbershop.name,
  }
}
