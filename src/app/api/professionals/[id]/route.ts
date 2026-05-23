import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"



export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = await params
  const body = await req.json()

  const exists = await prisma.professional.findFirst({
    where: {
      id: {
        not: id,
      },
      OR: [
        { name: { equals: body.name.trim(), mode: "insensitive" } },
        { email: { equals: body.email.trim(), mode: "insensitive" } },
      ],
    },
  })

  if (exists) {
    return NextResponse.json(
      { message: "Já existe um profissional com esse nome ou e-mail." },
      { status: 409 }
    )
  }

  const professional = await prisma.professional.update({
    where: { id },
    data: {
      name: body.name.trim(),
      email: body.email.trim(),
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  await prisma.professional.delete({
    where: { id },
  })

  return NextResponse.json({
    message: "Profissional excluído com sucesso.",
  })
}