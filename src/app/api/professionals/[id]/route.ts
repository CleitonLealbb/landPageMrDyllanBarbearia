import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentBarbershop, getSession } from "@/lib/auth/session"

type Params = Promise<{
  id: string
}>

export async function PUT(
  req: Request,
  context: { params: Params }
) {
  const session = await getSession()
  const barbershop = await getCurrentBarbershop()

  if (!session) {
    return NextResponse.json(
      { message: "Nao autenticado." },
      { status: 401 }
    )
  }

  if (!barbershop) {
    return NextResponse.json(
      { message: "Barbearia nao vinculada ao usuario." },
      { status: 404 }
    )
  }

  const { id } = await context.params
  const body = await req.json()

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

  const professional = await prisma.professional.update({
    where: { id },
    data: {
      name: body.name?.trim(),
      email: body.email?.trim(),
      role: body.role,
      permissionLevel: body.permissionLevel,
      commission: Number(body.commission),
      specialties: body.specialties ?? [],
      photoUrl: body.photoUrl,
    },
  })

  return NextResponse.json(professional)
}

export async function DELETE(
  req: Request,
  context: { params: Params }
) {
  const session = await getSession()
  const barbershop = await getCurrentBarbershop()

  if (!session) {
    return NextResponse.json(
      { message: "Nao autenticado." },
      { status: 401 }
    )
  }

  if (!barbershop) {
    return NextResponse.json(
      { message: "Barbearia nao vinculada ao usuario." },
      { status: 404 }
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
}
