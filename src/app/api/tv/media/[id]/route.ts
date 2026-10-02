import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/tv-session"

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

    const existingMedia =
      await prisma.tvMedia.findFirst({
        where: {
          id,
          barbershopId:
            session.barbershopId,
        },
      })

    if (!existingMedia) {
      return NextResponse.json(
        { error: "Mídia não encontrada" },
        { status: 404 }
      )
    }

    /*
     * ======================================
     * MOVER MÍDIA
     * ======================================
     */

    if (
      body.move === "up" ||
      body.move === "down"
    ) {
      const direction =
        body.move === "up"
          ? "desc"
          : "asc"

      const orderFilter =
        body.move === "up"
          ? {
              lt: existingMedia.order,
            }
          : {
              gt: existingMedia.order,
            }

      const targetMedia =
        await prisma.tvMedia.findFirst({
          where: {
            barbershopId:
              session.barbershopId,

            order: orderFilter,
          },

          orderBy: {
            order: direction,
          },
        })

      /*
       * Já está no topo ou no fim.
       */
      if (!targetMedia) {
        return NextResponse.json(
          existingMedia
        )
      }

      /*
       * Troca a posição das duas mídias.
       */
      await prisma.$transaction([
        prisma.tvMedia.update({
          where: {
            id: existingMedia.id,
          },

          data: {
            order:
              targetMedia.order,
          },
        }),

        prisma.tvMedia.update({
          where: {
            id: targetMedia.id,
          },

          data: {
            order:
              existingMedia.order,
          },
        }),
      ])

      const movedMedia =
        await prisma.tvMedia.findUnique({
          where: {
            id: existingMedia.id,
          },
        })

      return NextResponse.json(
        movedMedia
      )
    }

    /*
     * ======================================
     * ALTERAR ACTIVE / DURATION
     * ======================================
     */

    let newDuration =
      existingMedia.duration

    if (
      body.duration !== undefined
    ) {
      /*
       * Só permitimos alterar duração
       * manualmente de imagens.
       */
      if (
        existingMedia.type !== "IMAGE"
      ) {
        return NextResponse.json(
          {
            error:
              "A duração de vídeos é definida automaticamente.",
          },
          { status: 400 }
        )
      }

      if (
        typeof body.duration !==
          "number" ||
        !Number.isFinite(
          body.duration
        ) ||
        body.duration < 1 ||
        body.duration > 300
      ) {
        return NextResponse.json(
          {
            error:
              "A duração da imagem deve ficar entre 1 e 300 segundos.",
          },
          { status: 400 }
        )
      }

      newDuration =
        Math.round(body.duration)
    }

    const updatedMedia =
      await prisma.tvMedia.update({
        where: {
          id,
        },

        data: {
          active:
            typeof body.active ===
            "boolean"
              ? body.active
              : existingMedia.active,

          duration: newDuration,
        },
      })

    return NextResponse.json(
      updatedMedia
    )
  } catch (error) {
    console.error(
      "Erro ao atualizar mídia:",
      error
    )

    return NextResponse.json(
      {
        error:
          "Não foi possível atualizar a mídia",
      },
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
    const existingMedia =
      await prisma.tvMedia.findFirst({
        where: {
          id,
          barbershopId:
            session.barbershopId,
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
    console.error(
      "Erro ao excluir mídia:",
      error
    )

    return NextResponse.json(
      {
        error:
          "Não foi possível excluir a mídia",
      },
      { status: 500 }
    )
  }
}