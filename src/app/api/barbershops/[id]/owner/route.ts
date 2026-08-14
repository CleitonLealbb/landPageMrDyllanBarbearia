import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

const OWNER_FIELDS = new Set(["name", "email", "password", "alsoProvidesServices", "professionalRole", "permissionLevel", "commission", "specialties", "photoUrl"])

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 })
    if (session.type !== "USER" || session.globalRole !== "SUPER_ADMIN") return NextResponse.json({ message: "Acesso negado." }, { status: 403 })

    const { id: barbershopId } = await params
    const body = await req.json()
    if (Object.keys(body).some((key) => !OWNER_FIELDS.has(key))) return NextResponse.json({ message: "Campos inesperados." }, { status: 400 })
    if (!body.name || !body.email || !body.password) return NextResponse.json({ message: "Nome, e-mail e senha sao obrigatorios." }, { status: 400 })
    if (body.alsoProvidesServices !== undefined && typeof body.alsoProvidesServices !== "boolean") return NextResponse.json({ message: "Opcao de atendimento invalida." }, { status: 400 })

    const alsoProvidesServices = body.alsoProvidesServices === true
    const specialties = Array.isArray(body.specialties) ? body.specialties.filter((value: unknown): value is string => typeof value === "string").map((value: string) => value.trim()).filter(Boolean) : []
    if (alsoProvidesServices && (typeof body.professionalRole !== "string" || !body.professionalRole.trim() || !["BARBER", "ASSISTANT"].includes(body.permissionLevel) || !Number.isInteger(body.commission) || body.commission < 0 || body.commission > 100 || specialties.length === 0)) return NextResponse.json({ message: "Dados operacionais obrigatorios invalidos." }, { status: 400 })

    const barbershop = await prisma.barbershop.findUnique({ where: { id: barbershopId } })
    if (!barbershop) return NextResponse.json({ message: "Barbearia nao encontrada." }, { status: 404 })

    const email = body.email.trim().toLowerCase()
    const [existingUser, existingProfessional] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.professional.findUnique({ where: { email }, select: { id: true } }),
    ])
    if (existingUser || existingProfessional) return NextResponse.json({ message: "Nao foi possivel criar o proprietario com esse e-mail." }, { status: 409 })

    const password = await bcrypt.hash(body.password, 10)
    const data = { name: body.name.trim(), email, password, role: "BARBERSHOP_OWNER" as const, memberships: { create: { barbershopId, role: "BARBERSHOP_OWNER" as const } } }
    const select = { id: true, name: true, email: true, role: true, createdAt: true } as const
    const owner = alsoProvidesServices
      ? await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({ data, select })
          await tx.professional.create({ data: { barbershopId, userId: created.id, name: body.name.trim(), email, role: body.professionalRole.trim(), permissionLevel: body.permissionLevel, commission: body.commission, specialties, photoUrl: typeof body.photoUrl === "string" ? body.photoUrl.trim() || null : null, status: "ACTIVE", password: null, inviteToken: null, inviteExpires: null }, select: { id: true } })
          return created
        })
      : await prisma.user.create({ data, select })
    return NextResponse.json(owner)
  } catch {
    return NextResponse.json({ message: "Erro interno do servidor." }, { status: 500 })
  }
}
