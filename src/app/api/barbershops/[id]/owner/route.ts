import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"
import bcrypt from "bcryptjs"

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

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

export async function POST(
  req: Request,
  { params }: RouteParams
) {
  try {
    const authorizationError = await requireSuperAdmin()

    if (authorizationError) {
      return authorizationError
    }

  const { id: barbershopId } = await params
  const body = await req.json()

  if (!body.name || !body.email || !body.password) {
    return NextResponse.json(
      { message: "Nome, e-mail e senha são obrigatórios." },
      { status: 400 }
    )
  }

  const barbershop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
  })

  if (!barbershop) {
    return NextResponse.json(
      { message: "Barbearia não encontrada." },
      { status: 404 }
    )
  }

  const exists = await prisma.user.findUnique({
    where: {
      email: body.email.trim().toLowerCase(),
    },
  })

  if (exists) {
    return NextResponse.json(
      { message: "Já existe um usuário com esse e-mail." },
      { status: 409 }
    )
  }

  const hashedPassword = await bcrypt.hash(body.password, 10)

  const owner = await prisma.user.create({
    data: {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      password: hashedPassword,
      role: "BARBERSHOP_OWNER",
      memberships: {
        create: {
          barbershopId,
          role: "BARBERSHOP_OWNER",
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  })

    return NextResponse.json(owner)
  } catch {
    return internalServerErrorResponse()
  }
}
