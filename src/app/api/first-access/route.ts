import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  const body = await req.json()

  const token = body.token
  const password = body.password?.trim()

  if (!token || !password) {
    return NextResponse.json(
      { message: "Token e senha são obrigatórios." },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { message: "A senha deve ter pelo menos 6 caracteres." },
      { status: 400 }
    )
  }

  const professional = await prisma.professional.findFirst({
    where: {
      inviteToken: token,
      inviteExpires: {
        gt: new Date(),
      },
      status: "PENDING",
    },
  })

  if (!professional) {
    return NextResponse.json(
      { message: "Convite inválido ou expirado." },
      { status: 400 }
    )
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.professional.update({
    where: {
      id: professional.id,
    },
    data: {
      password: hashedPassword,
      status: "ACTIVE",
      inviteToken: null,
      inviteExpires: null,
    },
  })

  return NextResponse.json({
    message: "Senha criada com sucesso.",
  })
}