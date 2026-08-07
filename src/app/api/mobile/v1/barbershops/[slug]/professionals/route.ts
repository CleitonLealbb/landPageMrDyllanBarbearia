import { NextResponse } from "next/server"

import {
  barbershopNotFound,
  findActiveBarbershop,
  parseServiceIds,
  publicError,
  publicInternalError,
} from "@/lib/mobile/public-catalog"
import { prisma } from "@/lib/prisma"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: Request, context: RouteContext) {
  try {
    const parsedQuery = parseServiceIds(request)
    if (parsedQuery.response) return parsedQuery.response

    const { slug } = await context.params
    const barbershop = await findActiveBarbershop(slug)
    if (!barbershop) return barbershopNotFound()

    const requestedServiceIds = parsedQuery.serviceIds
    if (requestedServiceIds.length > 0) {
      const services = await prisma.service.findMany({
        where: {
          id: { in: requestedServiceIds },
          barbershopId: barbershop.id,
          status: "ACTIVE",
        },
        select: { id: true },
      })

      if (services.length !== requestedServiceIds.length) {
        return publicError(400, "INVALID_QUERY", "Servico invalido.")
      }
    }

    const professionals = await prisma.professional.findMany({
      where: {
        barbershopId: barbershop.id,
        status: "ACTIVE",
        services: { some: { service: { status: "ACTIVE" } } },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        photoUrl: true,
        services: {
          where: { service: { status: "ACTIVE" } },
          orderBy: { serviceId: "asc" },
          select: { serviceId: true },
        },
      },
    })

    const response = professionals
      .filter((professional) => {
        const enabled = new Set(
          professional.services.map((service) => service.serviceId)
        )
        return requestedServiceIds.every((serviceId) => enabled.has(serviceId))
      })
      .map((professional) => ({
        id: professional.id,
        name: professional.name,
        role: professional.role,
        photoUrl: professional.photoUrl,
        serviceIds: professional.services.map((service) => service.serviceId),
      }))

    return NextResponse.json(response)
  } catch {
    return publicInternalError()
  }
}
