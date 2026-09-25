import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
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

  const { id } = await context.params

  try {
    const body = await request.json()

    const existingMedia = await prisma.tvMedia.findFirst({
      where: {
        id,
        barbershopId: session.barbershopId,
      },
    })

    if (!existingMedia) {
      return NextResponse.json(
        { error: "Mídia não encontrada" },
        { status: 404 }
      )
    }

    const updatedMedia = await prisma.tvMedia.update({
      where: {
        id,
      },
      data: {
        active:
          typeof body.active === "boolean"
            ? body.active
            : existingMedia.active,
      },
    })

    return NextResponse.json(updatedMedia)
  } catch (error) {
    console.error("Erro ao atualizar mídia:", error)

    return NextResponse.json(
      { error: "Não foi possível atualizar a mídia" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
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

  const { id } = await context.params

  try {
    const existingMedia = await prisma.tvMedia.findFirst({
      where: {
        id,
        barbershopId: session.barbershopId,
      },
    })

    if (!existingMedia) {
      return NextResponse.json(
        { error: "Mídia não encontrada" },
        { status: 404 }
      )
    }

    await prisma.tvMedia.delete({
      where: {
        id,
      },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("Erro ao excluir mídia:", error)

    return NextResponse.json(
      { error: "Não foi possível excluir a mídia" },
      { status: 500 }
    )
  }
}