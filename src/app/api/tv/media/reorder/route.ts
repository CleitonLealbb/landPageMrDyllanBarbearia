import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/tv-session"

export async function PATCH(request: Request) {
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

    const ids: string[] =
      Array.isArray(body.ids)
        ? body.ids.filter(
            (id: unknown): id is string =>
              typeof id === "string"
          )
        : []

    if (ids.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma mídia foi informada.",
        },
        { status: 400 }
      )
    }

    const existingMedia =
      await prisma.tvMedia.findMany({
        where: {
          barbershopId:
            session.barbershopId,

          id: {
            in: ids,
          },
        },

        select: {
          id: true,
        },
      })

    if (
      existingMedia.length !==
      ids.length
    ) {
      return NextResponse.json(
        {
          error:
            "Uma ou mais mídias são inválidas.",
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(
      ids.map(
        (
          id: string,
          index: number
        ) =>
          prisma.tvMedia.update({
            where: {
              id,
            },

            data: {
              order: index,
            },
          })
      )
    )

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error(
      "Erro ao reordenar mídias:",
      error
    )

    return NextResponse.json(
      {
        error:
          "Não foi possível salvar a nova ordem.",
      },
      { status: 500 }
    )
  }
}