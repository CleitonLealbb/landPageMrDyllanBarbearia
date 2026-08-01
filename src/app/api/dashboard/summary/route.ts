import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentBarbershop, getSession } from "@/lib/auth/session"

const emptySummary = {
  barbershops: 0,
  owners: 0,
  professionals: 0,
  revenue: 0,
}

function internalServerErrorResponse() {
  return NextResponse.json(
    { message: "Erro interno do servidor." },
    { status: 500 }
  )
}

export async function GET() {
  try {
    const session = await getSession()

  if (!session) {
    return NextResponse.json(
      {
        ...emptySummary,
        message: "Nao autenticado.",
      },
      { status: 401 }
    )
  }

  if (
    session.type === "USER" &&
    session.globalRole === "SUPER_ADMIN"
  ) {
    const [barbershops, owners, professionals] = await Promise.all([
      prisma.barbershop.count(),
      prisma.user.count({
        where: { role: "BARBERSHOP_OWNER" },
      }),
      prisma.professional.count(),
    ])

    return NextResponse.json({
      role: session.globalRole,
      barbershops,
      owners,
      professionals,
      revenue: 0,
    })
  }

  const barbershop = await getCurrentBarbershop()

  if (!barbershop) {
    return NextResponse.json(
      {
        ...emptySummary,
        message: "Barbearia nao vinculada ao usuario.",
      },
      { status: 404 }
    )
  }

  const professionals = await prisma.professional.count({
    where: {
      barbershopId: barbershop.id,
    },
  })

    return NextResponse.json({
      role: session.tenantRole,
      barbershopId: barbershop.id,
      barbershopName: barbershop.name,
      barbershops: 1,
      owners: 0,
      professionals,
      clients: 0,
      appointments: 0,
      revenue: 0,
    })
  } catch {
    return internalServerErrorResponse()
  }
}
