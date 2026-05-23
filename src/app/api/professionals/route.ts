import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
        {
          name: {
            equals: body.name.trim(),
            mode: "insensitive",
          },
        },
        {
          email: {
            equals: body.email.trim(),
            mode: "insensitive",
          },
        },
      ],
    },
  })

  if (exists) {
    return NextResponse.json(
      {
        message:
          "Já existe um profissional com esse nome ou e-mail.",
      },
      { status: 409 }
    )
  }

  const professional =
    await prisma.professional.create({
      data: {
        name: body.name.trim(),
        email: body.email.trim(),
        role: body.role,
        commission: Number(body.commission),
        specialties: body.specialties,
      },
    })

  return NextResponse.json(professional)
}

export async function GET() {

  const professionals =
    await prisma.professional.findMany({
      orderBy: {
        createdAt: "desc",
      },
    })

  return NextResponse.json(professionals)
}