import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { Resend } from "resend"


export async function POST(req: Request) {
  const body = await req.json()

  if (!body.name || !body.email || !body.role) {
    return NextResponse.json(
      { message: "Nome, e-mail e cargo são obrigatórios." },
      { status: 400 }
    )
  }

  if (!body.specialties || body.specialties.length === 0) {
    return NextResponse.json(
      { message: "Adicione pelo menos uma especialidade." },
      { status: 400 }
    )
  }

  const exists = await prisma.professional.findFirst({
    where: {
      OR: [
        { name: { equals: body.name.trim(), mode: "insensitive" } },
        { email: { equals: body.email.trim(), mode: "insensitive" } },
      ],
    },
  })

  if (exists) {
    return NextResponse.json(
      { message: "Já existe um profissional com esse nome ou e-mail." },
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
      email: body.email.trim(),
      role: body.role,
      permissionLevel: body.permissionLevel,
      commission: Number(body.commission),
      specialties: body.specialties,
      photoUrl: body.photoUrl,
      status: "PENDING",
      inviteToken,
      inviteExpires,
    },
  })

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { message: "Profissional criado, mas RESEND_API_KEY não configurada." },
      { status: 201 }
    )
  }
  
  const resend = new Resend(process.env.RESEND_API_KEY)
  
  await resend.emails.send({
    from: "Mr Dyllan Barbearia <onboarding@resend.dev>",
    to: body.email.trim(),
    subject: "Crie sua senha de acesso",
    html: `
      <h2>Olá, ${body.name}</h2>
      <p>Você foi cadastrado no sistema da Mr Dyllan Barbearia.</p>
      <p>Clique no link abaixo para criar sua senha:</p>
      <p>
        <a href="${inviteLink}">
          Criar minha senha
        </a>
      </p>
      <p>Esse link expira em 24 horas.</p>
    `,
  })

  return NextResponse.json(professional)
}


export async function GET() {
  const professionals = await prisma.professional.findMany({
    orderBy: {
      createdAt: "desc",
    },
  })

  return NextResponse.json(professionals)
}