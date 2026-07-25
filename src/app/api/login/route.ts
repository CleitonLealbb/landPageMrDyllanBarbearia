import type { Professional, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { NextResponse } from "next/server"

const PROFESSIONAL_PERMISSION_LEVELS = ["BARBER", "ASSISTANT"] as const

type ProfessionalPermissionLevel =
  (typeof PROFESSIONAL_PERMISSION_LEVELS)[number]

type LoginAccount = {
  id: string
  email: string | null
  name: string
  password: string | null
  role: string
  photoUrl: string | null
}

function isProfessionalPermissionLevel(
  value: unknown
): value is ProfessionalPermissionLevel {
  return PROFESSIONAL_PERMISSION_LEVELS.some(
    (permissionLevel) => permissionLevel === value
  )
}

function professionalAccessDeniedResponse() {
  return NextResponse.json(
    { error: "Conta ainda não ativada. Verifique o convite de acesso." },
    { status: 403 }
  )
}

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

    let account: LoginAccount | null = null
    let professionalAccount: Professional | null = null
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
        account = professional
        professionalAccount = professional
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

    let authenticatedRole: Role | ProfessionalPermissionLevel

    if (accountType === "PROFESSIONAL") {
      if (!professionalAccount) {
        return NextResponse.json(
          { error: "E-mail ou senha inválidos" },
          { status: 401 }
        )
      }

      if (professionalAccount.status !== "ACTIVE") {
        return professionalAccessDeniedResponse()
      }

      if (
        !isProfessionalPermissionLevel(
          professionalAccount.permissionLevel
        )
      ) {
        return professionalAccessDeniedResponse()
      }

      if (
        typeof professionalAccount.barbershopId !== "string" ||
        professionalAccount.barbershopId.trim().length === 0
      ) {
        return professionalAccessDeniedResponse()
      }

      const barbershop = await prisma.barbershop.findUnique({
        where: {
          id: professionalAccount.barbershopId,
        },
        select: {
          id: true,
          status: true,
        },
      })

      if (!barbershop || barbershop.status !== "ACTIVE") {
        return professionalAccessDeniedResponse()
      }

      authenticatedRole = professionalAccount.permissionLevel
    } else {
      if (!user) {
        return NextResponse.json(
          { error: "E-mail ou senha inválidos" },
          { status: 401 }
        )
      }

      authenticatedRole = user.role
    }

    const token = jwt.sign(
      {
        userId: account.id,
        role: authenticatedRole,
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
        role: authenticatedRole,
        type: accountType,
        photoUrl: account.photoUrl ?? "",
      },
    })

    response.cookies.set("token", token, {
      httpOnly: true,
      path: "/",
    })
    return response
  } catch {
    console.error("Falha interna durante o login.")

    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    )
  }
}
