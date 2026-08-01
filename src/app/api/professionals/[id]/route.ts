import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentBarbershop, getSession } from "@/lib/auth/session"

function internalServerErrorResponse() {
  return NextResponse.json(
    { message: "Erro interno do servidor." },
    { status: 500 }
  )
}

function professionalNotFoundResponse() {
  return NextResponse.json(
    { message: "Profissional nao encontrado." },
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

const PROFESSIONAL_PERMISSION_LEVELS = [
  "BARBER",
  "ASSISTANT",
] as const

type ProfessionalPermissionLevel =
  (typeof PROFESSIONAL_PERMISSION_LEVELS)[number]

function isProfessionalPermissionLevel(
  value: unknown
): value is ProfessionalPermissionLevel {
  return PROFESSIONAL_PERMISSION_LEVELS.some(
    (permissionLevel) => permissionLevel === value
  )
}

const professionalPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  permissionLevel: true,
  commission: true,
  specialties: true,
  photoUrl: true,
  status: true,
} satisfies Prisma.ProfessionalSelect

type Params = Promise<{
  id: string
}>

export async function PUT(
  req: Request,
  context: { params: Params }
) {
  try {
    const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { message: "Nao autenticado." },
      { status: 401 }
    )
  }

  if (
    session.type !== "USER" ||
    session.globalRole !== null ||
    session.tenantRole !== "BARBERSHOP_OWNER" ||
    session.barbershopId === null
  ) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const barbershop = await getCurrentBarbershop()

  if (!barbershop) {
    return NextResponse.json(
      { message: "Barbearia nao vinculada ao usuario." },
      { status: 404 }
    )
  }

  const ownerMembership = await prisma.barbershopUser.findFirst({
    where: {
      userId: session.userId,
      barbershopId: session.barbershopId,
      role: "BARBERSHOP_OWNER",
    },
    select: {
      id: true,
    },
  })

  if (!ownerMembership) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const { id } = await context.params

  const exists = await prisma.professional.findFirst({
    where: {
      id,
      barbershopId: barbershop.id,
    },
  })

  if (!exists) {
    return NextResponse.json(
      { message: "Profissional nao encontrado." },
      { status: 404 }
    )
  }

  const body = await req.json()
  const permissionLevel: unknown = body.permissionLevel

  if (!isProfessionalPermissionLevel(permissionLevel)) {
    return NextResponse.json(
      { message: "Nível de permissão inválido." },
      { status: 400 }
    )
  }

  const permissionLevelChanged =
    exists.permissionLevel !== permissionLevel

  const professional = await prisma.professional.update({
    where: { id },
    data: {
      name: body.name?.trim(),
      email: body.email?.trim(),
      role: body.role,
      permissionLevel,
      commission: Number(body.commission),
      specialties: body.specialties ?? [],
      photoUrl: body.photoUrl,
      ...(permissionLevelChanged
        ? {
            sessionVersion: {
              increment: 1,
            },
          }
        : {}),
    },
    select: professionalPublicSelect,
  })

    return NextResponse.json(professional)
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return professionalNotFoundResponse()
    }

    return internalServerErrorResponse()
  }
}

export async function DELETE(
  req: Request,
  context: { params: Params }
) {
  try {
    const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { message: "Nao autenticado." },
      { status: 401 }
    )
  }

  if (
    session.type !== "USER" ||
    session.globalRole !== null ||
    session.tenantRole !== "BARBERSHOP_OWNER" ||
    session.barbershopId === null
  ) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const barbershop = await getCurrentBarbershop()

  if (!barbershop) {
    return NextResponse.json(
      { message: "Barbearia nao vinculada ao usuario." },
      { status: 404 }
    )
  }

  const ownerMembership = await prisma.barbershopUser.findFirst({
    where: {
      userId: session.userId,
      barbershopId: session.barbershopId,
      role: "BARBERSHOP_OWNER",
    },
    select: {
      id: true,
    },
  })

  if (!ownerMembership) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const { id } = await context.params

  const exists = await prisma.professional.findFirst({
    where: {
      id,
      barbershopId: barbershop.id,
    },
  })

  if (!exists) {
    return NextResponse.json(
      { message: "Profissional nao encontrado." },
      { status: 404 }
    )
  }

  await prisma.professional.delete({
    where: { id },
  })

    return NextResponse.json({
    message: "Profissional excluido com sucesso.",
    })
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return professionalNotFoundResponse()
    }

    return internalServerErrorResponse()
  }
}
