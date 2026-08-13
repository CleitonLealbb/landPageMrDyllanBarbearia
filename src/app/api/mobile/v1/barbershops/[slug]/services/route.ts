import { NextResponse } from "next/server"

import {
  barbershopNotFound,
  findActiveBarbershop,
  publicInternalError,
} from "@/lib/mobile/public-catalog"
import { prisma } from "@/lib/prisma"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params
    const barbershop = await findActiveBarbershop(slug)
    if (!barbershop) return barbershopNotFound()

    const services = await prisma.service.findMany({
      where: { barbershopId: barbershop.id, status: "ACTIVE" },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        priceCents: true,
        durationMinutes: true,
        displayOrder: true,
        category: {
          select: { id: true, name: true, displayOrder: true },
        },
      },
    })

    return NextResponse.json(services)
  } catch {
    return publicInternalError()
  }
}
