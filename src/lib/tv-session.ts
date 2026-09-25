import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

// Adapt the existing login cookie to the session used by TV routes.
export async function getSession(): Promise<{
  globalRole: string
  tenantRole: string
  barbershopId: string
} | null> {
  const token = (await cookies()).get("token")?.value
  const secret = process.env.JWT_SECRET
  if (!token || !secret) return null

  let payload: jwt.JwtPayload
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] })
    if (typeof decoded === "string") return null
    payload = decoded
  } catch {
    return null
  }
  if (payload.type !== "USER" || typeof payload.userId !== "string") return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  })
  if (!user || user.role !== "BARBERSHOP_OWNER") return null

  const membership = await prisma.barbershopUser.findFirst({
    where: {
      userId: payload.userId,
      role: "BARBERSHOP_OWNER",
      barbershop: { status: "ACTIVE" },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { barbershopId: true, role: true },
  })
  if (!membership) return null

  return {
    globalRole: user.role,
    tenantRole: membership.role,
    barbershopId: membership.barbershopId,
  }
}
