import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"

function internalServerErrorResponse() {
  return NextResponse.json(
    { message: "Erro interno do servidor." },
    { status: 500 }
  )
}

function barbershopNotFoundResponse() {
  return NextResponse.json(
    { message: "Barbearia não encontrada." },
    { status: 404 }
  )
}

function isPrismaNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  )
}

function isInvalidId(id: unknown): boolean {
  return typeof id !== "string" || id.trim().length === 0
}

function invalidIdResponse() {
  return NextResponse.json(
    { message: "Identificador inválido." },
    { status: 400 }
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

type Params = Promise<{
  id: string
}>

export async function PUT(
  req: Request,
  context: { params: Params }
) {
  try {
    const authorizationError = await requireSuperAdmin()

  if (authorizationError) {
    return authorizationError
  }

  const { id } = await context.params

  if (isInvalidId(id)) {
    return invalidIdResponse()
  }

  const body = await req.json()

  const barbershop = await prisma.barbershop.update({
    where: { id },
    data: {
      name: body.name?.trim(),
      phone: body.phone,
      email: body.email,
      address: body.address,
      status: body.status,
    },
  })

    return NextResponse.json(barbershop)
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return barbershopNotFoundResponse()
    }

    return internalServerErrorResponse()
  }
}

export async function DELETE(
  req: Request,
  context: { params: Params }
) {
  try {
    const authorizationError = await requireSuperAdmin()

  if (authorizationError) {
    return authorizationError
  }

  const { id } = await context.params

  if (isInvalidId(id)) {
    return invalidIdResponse()
  }

  const [linkedUsers, linkedProfessionals] = await Promise.all([
    prisma.barbershopUser.count({
      where: {
        barbershopId: id,
      },
    }),
    prisma.professional.count({
      where: {
        barbershopId: id,
      },
    }),
  ])

  if (linkedUsers > 0 || linkedProfessionals > 0) {
    return NextResponse.json(
      {
        message:
          "Esta barbearia possui usuÃ¡rios ou profissionais vinculados e nÃ£o pode ser excluÃ­da.",
      },
      { status: 409 }
    )
  }

  await prisma.barbershop.delete({
    where: { id },
  })

    return NextResponse.json({
    message: "Barbearia excluída com sucesso.",
    })
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return barbershopNotFoundResponse()
    }

    return internalServerErrorResponse()
  }
}
