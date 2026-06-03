import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

export async function PUT(
  req: Request,
  { params }: RouteParams
) {
  const { id } = await params
  const body = await req.json()

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
  { params }: RouteParams
) {
  const { id } = await params

  await prisma.professional.delete({
    where: { id },
  })

  return NextResponse.json({
    message: "Profissional excluído com sucesso.",
  })
}