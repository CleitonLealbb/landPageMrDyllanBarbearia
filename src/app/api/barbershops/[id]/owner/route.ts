import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

export async function POST(
  req: Request,
  { params }: RouteParams
) {
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
}