import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  adminServiceSelect,
  internalErrorResponse,
  isPrismaUniqueError,
  isRecord,
  requireCatalogOwner,
  validateProfessionalIds,
  validateServiceBody,
} from "@/lib/services/catalog"

function validationError(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

export async function GET() {
  try {
    const authorization = await requireCatalogOwner()
    if (authorization.response) return authorization.response

    const services = await prisma.service.findMany({
      where: { barbershopId: authorization.owner.barbershopId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: adminServiceSelect,
    })

    return NextResponse.json(services)
  } catch {
    return internalErrorResponse()
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await requireCatalogOwner()
    if (authorization.response) return authorization.response

    const body: unknown = await request.json()
    if (!isRecord(body)) return validationError("Corpo da requisicao invalido.")

    const { professionalIds: rawProfessionalIds, ...serviceBody } = body
    const serviceValidation = validateServiceBody(serviceBody, false)
    if (serviceValidation.error) return validationError(serviceValidation.error)
    const serviceData = serviceValidation.value!
    if (serviceData.categoryId) {
      const category = await prisma.serviceCategory.findFirst({ where: { id: serviceData.categoryId, barbershopId: authorization.owner.barbershopId, status: "ACTIVE" }, select: { id: true } })
      if (!category) return validationError("Categoria invalida ou inativa.")
    }

    const professionalValidation =
      rawProfessionalIds === undefined
        ? { value: [] as string[] }
        : validateProfessionalIds(rawProfessionalIds)
    if ("error" in professionalValidation) {
      return validationError(professionalValidation.error ?? "professionalIds invalido.")
    }

    const professionalIds = professionalValidation.value!
    const barbershopId = authorization.owner.barbershopId

    if (professionalIds.length > 0) {
      const professionals = await prisma.professional.findMany({
        where: { id: { in: professionalIds }, barbershopId },
        select: { id: true },
      })

      if (professionals.length !== professionalIds.length) {
        return validationError("Profissional invalido para esta barbearia.")
      }
    }

    const service = await prisma.$transaction((transaction) =>
      transaction.service.create({
        data: {
          barbershopId,
          name: serviceData.name!,
          description: serviceData.description,
          priceCents: serviceData.priceCents!,
          durationMinutes: serviceData.durationMinutes!,
          displayOrder: serviceData.displayOrder,
          status: serviceData.status,
          categoryId: serviceData.categoryId,
          professionals: {
            create: professionalIds.map((professionalId) => ({
              barbershopId,
              professionalId,
            })),
          },
        },
        select: adminServiceSelect,
      })
    )

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        { message: "Ja existe um servico com este nome." },
        { status: 409 }
      )
    }
    return internalErrorResponse()
  }
}
