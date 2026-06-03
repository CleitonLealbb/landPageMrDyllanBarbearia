import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const barbershops = await prisma.barbershop.findMany({
    orderBy: {
      createdAt: "desc",
    },
  })

  return NextResponse.json(barbershops)
}

export async function POST(req: Request) {
  const body = await req.json()

  if (!body.name) {
    return NextResponse.json(
      { message: "Nome da barbearia é obrigatório." },
      { status: 400 }
    )
  }

  const barbershop = await prisma.barbershop.create({
    data: {
      name: body.name.trim(),
      phone: body.phone,
      email: body.email,
      address: body.address,
    },
  })

  return NextResponse.json(barbershop)
}