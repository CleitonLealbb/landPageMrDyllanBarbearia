import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { Resend } from "resend"
import { getCurrentBarbershop, getSession } from "@/lib/auth/session"

const professionalPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  permissionLevel: true,
  commission: true,
  specialties: true,
  photoUrl: true,
  status: true,
} satisfies Prisma.ProfessionalSelect

const PROFESSIONAL_PERMISSION_LEVELS = ["BARBER", "ASSISTANT"] as const

type ProfessionalPermissionLevel =
  (typeof PROFESSIONAL_PERMISSION_LEVELS)[number]

function isProfessionalPermissionLevel(
  value: unknown
): value is ProfessionalPermissionLevel {
  return PROFESSIONAL_PERMISSION_LEVELS.some(
    (permissionLevel) => permissionLevel === value
  )
}

export async function POST(req: Request) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { message: "Nao autenticado." },
      { status: 401 }
    )
  }

  if (
    session.type !== "USER" ||
    session.globalRole !== null ||
    session.tenantRole !== "BARBERSHOP_OWNER" ||
    session.barbershopId === null
  ) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const barbershop = await getCurrentBarbershop()

  if (
    !barbershop ||
    barbershop.id !== session.barbershopId
  ) {
    return NextResponse.json(
      { message: "Barbearia nao vinculada ao usuario." },
      { status: 404 }
    )
  }

  const ownerMembership = await prisma.barbershopUser.findFirst({
    where: {
      userId: session.userId,
      barbershopId: session.barbershopId,
      role: "BARBERSHOP_OWNER",
    },
    select: {
      id: true,
    },
  })

  if (!ownerMembership) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const body = await req.json()

  if (!body.name || !body.email || !body.role) {
    return NextResponse.json(
      { message: "Nome, e-mail e cargo sao obrigatorios." },
      { status: 400 }
    )
  }

  if (!body.specialties || body.specialties.length === 0) {
    return NextResponse.json(
      { message: "Adicione pelo menos uma especialidade." },
      { status: 400 }
    )
  }

  const permissionLevel: unknown = body.permissionLevel

  if (!isProfessionalPermissionLevel(permissionLevel)) {
    return NextResponse.json(
      { message: "Nível de permissão inválido." },
      { status: 400 }
    )
  }

  const exists = await prisma.professional.findFirst({
    where: {
      barbershopId: barbershop.id,
      OR: [
        { name: { equals: body.name.trim(), mode: "insensitive" } },
        { email: { equals: body.email.trim(), mode: "insensitive" } },
      ],
    },
  })

  if (exists) {
    return NextResponse.json(
      { message: "Ja existe um profissional com esse nome ou e-mail." },
      { status: 409 }
    )
  }

  const inviteToken = crypto.randomBytes(32).toString("hex")

  const inviteExpires = new Date(
    Date.now() + 1000 * 60 * 60 * 24
  )

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/primeiro-acesso?token=${inviteToken}`

  const professional = await prisma.professional.create({
    data: {
      name: body.name.trim(),
      barbershopId: barbershop.id,
      email: body.email.trim(),
      role: body.role,
      permissionLevel,
      commission: Number(body.commission),
      specialties: body.specialties,
      photoUrl: body.photoUrl,
      status: "PENDING",
      inviteToken,
      inviteExpires,
    },
    select: professionalPublicSelect,
  })

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { message: "Profissional criado, mas RESEND_API_KEY nao configurada." },
      { status: 201 }
    )
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: process.env.MAIL_FROM!,
    to: body.email.trim(),
    subject: "Crie sua senha de acesso ao Agendo Barber",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bem-vindo ao Agendo Barber</h2>

        <p>Ola, ${body.name}.</p>

        <p>
          Voce foi convidado para acessar o sistema
          ${barbershop.name ? `da barbearia <strong>${barbershop.name}</strong>` : "da sua barbearia"}.
        </p>

        <p>Clique no botao abaixo para criar sua senha de acesso:</p>

        <p>
          <a
            href="${inviteLink}"
            style="
              background:#facc15;
              color:#000;
              padding:12px 20px;
              text-decoration:none;
              border-radius:8px;
              display:inline-block;
              font-weight:bold;
            "
          >
            Criar minha senha
          </a>
        </p>

        <p>Este link expira em 24 horas.</p>

        <p>Se voce nao reconhece este convite, ignore este e-mail.</p>

        <hr />

        <small>
          ${barbershop.name ?? "Agendo Barber"}
        </small>
      </div>
    `,
  })

  return NextResponse.json(professional)
}

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { message: "Nao autenticado." },
      { status: 401 }
    )
  }

  if (
    session.type !== "USER" ||
    session.globalRole !== null ||
    session.tenantRole !== "BARBERSHOP_OWNER" ||
    session.barbershopId === null
  ) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const barbershop = await getCurrentBarbershop()

  if (
    !barbershop ||
    barbershop.id !== session.barbershopId
  ) {
    return NextResponse.json(
      { message: "Barbearia nao vinculada ao usuario." },
      { status: 404 }
    )
  }

  const ownerMembership = await prisma.barbershopUser.findFirst({
    where: {
      userId: session.userId,
      barbershopId: session.barbershopId,
      role: "BARBERSHOP_OWNER",
    },
    select: {
      id: true,
    },
  })

  if (!ownerMembership) {
    return NextResponse.json(
      { message: "Acesso negado." },
      { status: 403 }
    )
  }

  const professionals = await prisma.professional.findMany({
    where: {
      barbershopId: barbershop.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: professionalPublicSelect,
  })

  return NextResponse.json(professionals)
}
