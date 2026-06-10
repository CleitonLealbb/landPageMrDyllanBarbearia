import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentBarbershop, getSession } from "@/lib/auth/session"

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { message: "NÃ£o autenticado." },
      { status: 401 }
    )
  }

  if (session.role === "SUPER_ADMIN") {
    const [barbershops, owners, professionals] = await Promise.all([
      prisma.barbershop.count(),
      prisma.user.count({
        where: { role: "BARBERSHOP_OWNER" },
      }),
      prisma.professional.count(),
    ])

    return NextResponse.json({
      role: session.role,
      barbershops,
      owners,
      professionals,
      revenue: 0,
    })
  }

  const barbershop = await getCurrentBarbershop()

  if (!barbershop) {
    return NextResponse.json(
      { message: "Barbearia nÃ£o vinculada ao usuÃ¡rio." },
      { status: 404 }
    )
  }

  return NextResponse.json({
    role: session.role,
    barbershopId: barbershop.id,
    barbershopName: barbershop.name,
    professionals: 0,
    clients: 0,
    appointments: 0,
    revenue: 0,
  })
}
