import type { Professional } from "@prisma/client"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import type {
  ProfessionalTenantRole,
  Session,
  TenantRole,
} from "@/lib/auth/claims"

const PROFESSIONAL_PERMISSION_LEVELS = ["BARBER", "ASSISTANT"] as const

type LoginAccount = {
  id: string
  email: string | null
  name: string
  password: string | null
  photoUrl: string | null
  sessionVersion: number
}

function isProfessionalPermissionLevel(
  value: unknown
): value is ProfessionalTenantRole {
  return PROFESSIONAL_PERMISSION_LEVELS.some(
    (permissionLevel) => permissionLevel === value
  )
}

function accountAccessDeniedResponse() {
  return NextResponse.json(
    { error: "Acesso negado." },
    { status: 403 }
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

    let sessionPayload: Session
    let globalRole: "SUPER_ADMIN" | null
    let tenantRole: TenantRole | null

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

      sessionPayload = {
        type: "PROFESSIONAL",
        professionalId: professionalAccount.id,
        globalRole: null,
        tenantRole: professionalAccount.permissionLevel,
        barbershopId: professionalAccount.barbershopId,
        sessionVersion: professionalAccount.sessionVersion,
      }
      globalRole = null
      tenantRole = professionalAccount.permissionLevel
    } else {
      if (!user) {
        return NextResponse.json(
          { error: "E-mail ou senha inválidos" },
          { status: 401 }
        )
      }

      if (user.role === "SUPER_ADMIN") {
        sessionPayload = {
          type: "USER",
          userId: user.id,
          globalRole: "SUPER_ADMIN",
          tenantRole: null,
          barbershopId: null,
          sessionVersion: user.sessionVersion,
        }
        globalRole = "SUPER_ADMIN"
        tenantRole = null
      } else {
        const memberships = await prisma.barbershopUser.findMany({
          where: {
            userId: user.id,
            barbershop: {
              status: "ACTIVE",
            },
          },
          select: {
            barbershopId: true,
            role: true,
          },
        })

        if (
          memberships.length !== 1 ||
          memberships[0].role !== user.role
        ) {
          return accountAccessDeniedResponse()
        }

        const [membership] = memberships

        sessionPayload = {
          type: "USER",
          userId: user.id,
          globalRole: null,
          tenantRole: membership.role,
          barbershopId: membership.barbershopId,
          sessionVersion: user.sessionVersion,
        }
        globalRole = null
        tenantRole = membership.role
      }
    }

    const token = jwt.sign(
      sessionPayload,
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    )

    const response = NextResponse.json({
      success: true,
      user: {
        id: account.id,
        email: account.email,
        name: account.name,
        type: accountType,
        globalRole,
        tenantRole,
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
