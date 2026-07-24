import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    const cleanEmail = email?.trim().toLowerCase()

    if (!cleanEmail || !password) {
      return NextResponse.json(
        { error: "E-mail e senha são obrigatórios" },
        { status: 400 }
      )
    }

    let account: any = null
    let accountType: "USER" | "PROFESSIONAL" = "USER"

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    })

    if (user) {
      account = user
      accountType = "USER"
    } else {
      const professional = await prisma.professional.findUnique({
        where: { email: cleanEmail },
      })

      if (professional) {
        if (professional.status !== "ACTIVE") {
          return NextResponse.json(
            { error: "Conta ainda não ativada. Verifique o convite de acesso." },
            { status: 403 }
          )
        }

        account = professional
        accountType = "PROFESSIONAL"
      }
    }
    if (!account || !account.password) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos" },
        { status: 401 }
      )
    }

    const valid = await bcrypt.compare(password, account.password)

    if (!valid) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos" },
        { status: 401 }
      )
    }

    const token = jwt.sign(
      {
        userId: account.id,
        role:
          accountType === "PROFESSIONAL"
            ? account.permissionLevel
            : account.role,
        type: accountType,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    )

    const response = NextResponse.json({
      success: true,
      user: {
        id: account.id,
        email: account.email,
        name: account.name,
        role:
          accountType === "PROFESSIONAL"
            ? account.permissionLevel
            : account.role,
        type: accountType,
        photoUrl: account.photoUrl ?? "",
      },
    })

    response.cookies.set("token", token, {
      httpOnly: true,
      path: "/",
    })
    return response
  } catch (error: any) {
    console.error("Falha interna durante o login.")

    return NextResponse.json(
      { error: error?.message || "Erro interno" },
      { status: 500 }
    )
  }
}
