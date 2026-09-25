import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const barbershopId =
      "2353b0a9-fd90-4331-a58e-0fd0df307cdf"

    const media = await prisma.tvMedia.findMany({
      where: {
        barbershopId,
        active: true,
      },
      orderBy: [
        {
          order: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        url: true,
        type: true,
        order: true,
      },
    })

    return NextResponse.json({
      success: true,
      media,
    })
  } catch (error) {
    console.error("Erro na playlist da TV:", error)

    return NextResponse.json(
      {
        success: false,
        media: [],
      },
      {
        status: 500,
      }
    )
  }
}