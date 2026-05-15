import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos" },
        { status: 401 }
      )
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos" },
        { status: 401 }
      )
    }

    const token = jwt.sign(
      { userId: user.id,
        role: user.role,
       },

      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    )

    const response = NextResponse.json({ 
      success: true,
      user: {  
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      })

    response.cookies.set("token", token, {
      httpOnly: true,
      path: "/",
    })

    return response
  } catch (error: any) {
  
    return NextResponse.json(
      { error: error?.message || "Erro interno" },
      { status: 500 }
    )
  }
}
console.log("DATABASE_URL exists?", !!process.env.DATABASE_URL)
console.log("JWT_SECRET exists?", !!process.env.JWT_SECRET)