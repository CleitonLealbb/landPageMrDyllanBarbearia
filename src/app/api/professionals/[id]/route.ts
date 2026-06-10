import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Params = Promise<{
  id: string
}>

export async function PUT(
  req: Request,
  context: { params: Params }
) {
  const { id } = await context.params
  const body = await req.json()

  if (!body.barbershopId) {
    return NextResponse.json(
      { message: "Barbearia Ã© obrigatÃ³ria." },
      { status: 400 }
    )
  }

  const exists = await prisma.professional.findFirst({
    where: {
      id,
      barbershopId: body.barbershopId,
    },
  })

  if (!exists) {
    return NextResponse.json(
      { message: "Profissional nÃ£o encontrado." },
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
  const { id } = await context.params
  const { searchParams } = new URL(req.url)
  const barbershopId = searchParams.get("barbershopId")

  if (!barbershopId) {
    return NextResponse.json(
      { message: "Barbearia Ã© obrigatÃ³ria." },
      { status: 400 }
    )
  }

  const exists = await prisma.professional.findFirst({
    where: {
      id,
      barbershopId,
    },
  })

  if (!exists) {
    return NextResponse.json(
      { message: "Profissional nÃ£o encontrado." },
      { status: 404 }
    )
  }

  await prisma.professional.delete({
    where: { id },
  })

  return NextResponse.json({
    message: "Profissional excluído com sucesso.",
  })
}
