import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  adminServiceSelect,
  internalErrorResponse,
  isPrismaUniqueError,
  requireCatalogOwner,
  validateServiceBody,
} from "@/lib/services/catalog"

type RouteContext = { params: Promise<{ id: string }> }

function notFoundResponse() {
  return NextResponse.json({ message: "Servico nao encontrado." }, { status: 404 })
}

function validationError(message: string) {
  return NextResponse.json({ message }, { status: 400 })
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const authorization = await requireCatalogOwner()
    if (authorization.response) return authorization.response

    const { id } = await context.params
    if (!id?.trim()) return validationError("Identificador invalido.")

    const existing = await prisma.service.findFirst({
      where: { id, barbershopId: authorization.owner.barbershopId },
      select: { id: true },
    })
    if (!existing) return notFoundResponse()

    const body: unknown = await request.json()
    const validation = validateServiceBody(body, true)
    if (validation.error) return validationError(validation.error)

    const data = validation.value ?? {}
    const service = await prisma.service.update({
      where: { id },
      data,
      select: adminServiceSelect,
    })

    return NextResponse.json(service)
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const authorization = await requireCatalogOwner()
    if (authorization.response) return authorization.response

    const { id } = await context.params
    if (!id?.trim()) return validationError("Identificador invalido.")

    const existing = await prisma.service.findFirst({
      where: { id, barbershopId: authorization.owner.barbershopId },
      select: adminServiceSelect,
    })
    if (!existing) return notFoundResponse()
    if (existing.status === "INACTIVE") return NextResponse.json(existing)

    const service = await prisma.service.update({
      where: { id },
      data: { status: "INACTIVE" },
      select: adminServiceSelect,
    })

    return NextResponse.json(service)
  } catch {
    return internalErrorResponse()
  }
}
