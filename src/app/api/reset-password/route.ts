import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const body = await req.json()
  const token = body.token?.trim()
  const password = body.password?.trim()

  if (!token || !password) {
    return NextResponse.json(
      { message: "Token e senha sao obrigatorios." },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    return NextResponse.json(
      { message: "A senha deve ter pelo menos 6 caracteres." },
      { status: 400 }
    )
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetExpires: {
        gt: new Date(),
      },
    },
  })

  const hashedPassword = await bcrypt.hash(password, 10)

  if (user) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetExpires: null,
        sessionVersion: {
          increment: 1,
        },
      },
    })

    return NextResponse.json({
      message: "Senha atualizada com sucesso.",
    })
  }

  const professional = await prisma.professional.findFirst({
    where: {
      resetToken: token,
      resetExpires: {
        gt: new Date(),
      },
    },
  })

  if (!professional) {
    return NextResponse.json(
      { message: "Token invalido ou expirado." },
      { status: 400 }
    )
  }

  await prisma.professional.update({
    where: {
      id: professional.id,
    },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetExpires: null,
      sessionVersion: {
        increment: 1,
      },
    },
  })

  return NextResponse.json({
    message: "Senha atualizada com sucesso.",
  })
}
