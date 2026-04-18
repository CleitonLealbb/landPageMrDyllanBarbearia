import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { email, password, remember } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail e senha são obrigatórios!" },
        { status: 400 }
      )
    }

    console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL)
    console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET)
    console.log("Iniciando consulta no banco...")

    // const user = await prisma.user.findUnique({
    //   where: { email },
    // })
    const usersCount = await prisma.user.count()
console.log("Total de usuários:", usersCount)

const user = await prisma.user.findUnique({
  where: { email },
})

    if (!user) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos!" },
        { status: 401 }
      )
    }

    const ok = await bcrypt.compare(password, user.password)

    if (!ok) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos!" },
        { status: 401 }
      )
    }

    const secret = process.env.JWT_SECRET

    if (!secret) {
      return NextResponse.json(
        { error: "JWT_SECRET não definido no .env" },
        { status: 500 }
      )
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      secret,
      { expiresIn: remember ? "7d" : "1d" }
    )

    const res = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    })

    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24,
    })

    return res
  } catch (error) {
    console.error("Erro no login:", error)

    return NextResponse.json(
      { error: "Erro interno no servidor" },
      { status: 500 }
    )
  }
}

