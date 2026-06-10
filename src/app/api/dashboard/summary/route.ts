import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

type TokenPayload = {
  userId: string
  role: "SUPER_ADMIN" | "BARBERSHOP_OWNER" | "BARBER" | "ASSISTANT"
  type: "USER" | "PROFESSIONAL"
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) {
    return NextResponse.json(
      { message: "Não autenticado." },
      { status: 401 }
    )
  }

  const payload = jwt.verify(
    token,
    process.env.JWT_SECRET!
  ) as TokenPayload

  if (payload.role === "SUPER_ADMIN") {
    const [barbershops, owners, professionals] = await Promise.all([
      prisma.barbershop.count(),
      prisma.user.count({
        where: { role: "BARBERSHOP_OWNER" },
      }),
      prisma.professional.count(),
    ])

    return NextResponse.json({
      role: payload.role,
      barbershops,
      owners,
      professionals,
      revenue: 0,
    })
  }

  if (payload.role === "BARBERSHOP_OWNER") {
    const membership = await prisma.barbershopUser.findFirst({
      where: {
        userId: payload.userId,
        role: "BARBERSHOP_OWNER",
      },
      include: {
        barbershop: true,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { message: "Barbearia não vinculada ao usuário." },
        { status: 404 }
      )
    }

    return NextResponse.json({
      role: payload.role,
      barbershopId: membership.barbershopId,
      barbershopName: membership.barbershop.name,
      professionals: 0,
      clients: 0,
      appointments: 0,
      revenue: 0,
    })
  }

  return NextResponse.json({
    role: payload.role,
    professionals: 0,
    clients: 0,
    appointments: 0,
    revenue: 0,
  })
}