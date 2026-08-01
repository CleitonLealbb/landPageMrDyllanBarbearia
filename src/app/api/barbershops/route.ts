import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"

function internalServerErrorResponse() {
  return NextResponse.json(
    { message: "Erro interno do servidor." },
    { status: 500 }
  )
}

async function requireSuperAdmin() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { message: "Não autenticado." },
      { status: 401 }
    )
  }

  if (
    session.type !== "USER" ||
    session.globalRole !== "SUPER_ADMIN"
  ) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  return null
}

export async function GET() {
  try {
    const authorizationError = await requireSuperAdmin()

    if (authorizationError) {
      return authorizationError
    }

  const barbershops = await prisma.barbershop.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      status: true,
      members: {
        where: {
          role: "BARBERSHOP_OWNER",
        },
        select: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })

    return NextResponse.json(barbershops)
  } catch {
    return internalServerErrorResponse()
  }
}

export async function POST(req: Request) {
  try {
    const authorizationError = await requireSuperAdmin()

    if (authorizationError) {
      return authorizationError
    }

  const body = await req.json()

  if (!body.name) {
    return NextResponse.json(
      { message: "Nome da barbearia é obrigatório." },
      { status: 400 }
    )
  }

  const barbershop = await prisma.barbershop.create({
    data: {
      name: body.name.trim(),
      phone: body.phone,
      email: body.email,
      address: body.address,
    },
  })

    return NextResponse.json(barbershop)
  } catch {
    return internalServerErrorResponse()
  }
}
