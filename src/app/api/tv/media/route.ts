import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"

export async function GET() {
  const session = await getSession()

  if (
    !session ||
    session.globalRole === "SUPER_ADMIN" ||
    session.tenantRole !== "BARBERSHOP_OWNER" ||
    !session.barbershopId
  ) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    )
  }

  const media = await prisma.tvMedia.findMany({
    where: {
      barbershopId: session.barbershopId,
    },
    orderBy: [
      { order: "asc" },
      { createdAt: "asc" },
    ],
  })

  return NextResponse.json(media)
}

export async function POST(request: Request) {
  const session = await getSession()

  if (
    !session ||
    session.globalRole === "SUPER_ADMIN" ||
    session.tenantRole !== "BARBERSHOP_OWNER" ||
    !session.barbershopId
  ) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : ""

    const url =
      typeof body.url === "string"
        ? body.url.trim()
        : ""

    const type =
      body.type === "IMAGE"
        ? "IMAGE"
        : "VIDEO"

    if (!name || !url) {
      return NextResponse.json(
        { error: "Nome e URL são obrigatórios." },
        { status: 400 }
      )
    }

    const lastMedia = await prisma.tvMedia.findFirst({
      where: {
        barbershopId: session.barbershopId,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    })

    const nextOrder = (lastMedia?.order ?? -1) + 1

    const media = await prisma.tvMedia.create({
      data: {
        barbershopId: session.barbershopId,
        name,
        url,
        type,
        order: nextOrder,
        active: true,
      },
    })

    return NextResponse.json(media, {
      status: 201,
    })
  } catch (error) {
    console.error("Erro ao cadastrar mídia:", error)

    return NextResponse.json(
      { error: "Não foi possível cadastrar a mídia." },
      { status: 500 }
    )
  }
}