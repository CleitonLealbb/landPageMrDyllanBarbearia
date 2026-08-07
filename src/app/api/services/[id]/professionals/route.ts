import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  adminServiceSelect,
  internalErrorResponse,
  isRecord,
  requireCatalogOwner,
  validateProfessionalIds,
} from "@/lib/services/catalog"

type RouteContext = { params: Promise<{ id: string }> }

function validationError(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const authorization = await requireCatalogOwner()
    if (authorization.response) return authorization.response

    const { id } = await context.params
    if (!id?.trim()) return validationError("Identificador invalido.")

    const body: unknown = await request.json()
    if (
      !isRecord(body) ||
      Object.keys(body).some((key) => key !== "professionalIds")
    ) {
      return validationError("Corpo da requisicao invalido.")
    }

    const idsValidation = validateProfessionalIds(body.professionalIds)
    if (idsValidation.error) return validationError(idsValidation.error)

    const barbershopId = authorization.owner.barbershopId
    const service = await prisma.service.findFirst({
      where: { id, barbershopId },
      select: { id: true },
    })
    if (!service) {
      return NextResponse.json(
        { message: "Servico nao encontrado." },
        { status: 404 }
      )
    }

    const professionalIds = idsValidation.value ?? []
    if (professionalIds.length > 0) {
      const professionals = await prisma.professional.findMany({
        where: { id: { in: professionalIds }, barbershopId },
        select: { id: true },
      })
      if (professionals.length !== professionalIds.length) {
        return validationError("Profissional invalido para esta barbearia.")
      }
    }

    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.professionalService.deleteMany({
        where: { barbershopId, serviceId: id },
      })

      if (professionalIds.length > 0) {
        await transaction.professionalService.createMany({
          data: professionalIds.map((professionalId) => ({
            barbershopId,
            serviceId: id,
            professionalId,
          })),
        })
      }

      return transaction.service.findFirst({
        where: { id, barbershopId },
        select: adminServiceSelect,
      })
    })

    return NextResponse.json(updated)
  } catch {
    return internalErrorResponse()
  }
}
