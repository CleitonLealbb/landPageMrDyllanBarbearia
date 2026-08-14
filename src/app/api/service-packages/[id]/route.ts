import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { internalErrorResponse, isPrismaUniqueError, requireCatalogOwner } from "@/lib/services/catalog"
import { adminPackageSelect, presentPackage, validatePackageBody } from "@/lib/services/packages"

type Context = { params: Promise<{ id: string }> }
const bad = (message: string) => NextResponse.json({ message }, { status: 400 })
const missing = () => NextResponse.json({ message: "Combo nao encontrado." }, { status: 404 })

export async function PUT(request: Request, context: Context) {
  try {
    const auth = await requireCatalogOwner(); if (auth.response) return auth.response
    const { id } = await context.params; const barbershopId = auth.owner.barbershopId
    const current = await prisma.servicePackage.findFirst({ where: { id, barbershopId }, select: adminPackageSelect }); if (!current) return missing()
    const validation = validatePackageBody(await request.json(), true); if (validation.error) return bad(validation.error)
    const data = validation.value!; let originalPrice = current.items.reduce((sum, item) => sum + item.service.priceCents, 0)
    if (data.serviceIds) {
      const services = await prisma.service.findMany({ where: { id: { in: data.serviceIds }, barbershopId, status: "ACTIVE" }, select: { id: true, priceCents: true } })
      if (services.length !== data.serviceIds.length) return bad("Servico invalido ou inativo.")
      originalPrice = services.reduce((sum, service) => sum + service.priceCents, 0)
    }
    if ((data.priceCents ?? current.priceCents) > originalPrice) return bad("O preco promocional nao pode superar o preco original.")
    const updated = await prisma.$transaction(async (tx) => {
      if (data.serviceIds) {
        await tx.servicePackageItem.deleteMany({ where: { barbershopId, packageId: id } })
        await tx.servicePackageItem.createMany({ data: data.serviceIds.map((serviceId, displayOrder) => ({ barbershopId, packageId: id, serviceId, displayOrder })) })
      }
      const { serviceIds: _ids, ...write } = data
      return tx.servicePackage.update({ where: { id }, data: write, select: adminPackageSelect })
    })
    return NextResponse.json(presentPackage(updated))
  } catch (error) {
    if (isPrismaUniqueError(error)) return NextResponse.json({ message: "Ja existe um combo com este nome." }, { status: 409 })
    return internalErrorResponse()
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const auth = await requireCatalogOwner(); if (auth.response) return auth.response
    const { id } = await context.params; const barbershopId = auth.owner.barbershopId
    const current = await prisma.servicePackage.findFirst({ where: { id, barbershopId }, select: adminPackageSelect }); if (!current) return missing()
    if (current.status === "INACTIVE") return NextResponse.json(presentPackage(current))
    return NextResponse.json(presentPackage(await prisma.servicePackage.update({ where: { id }, data: { status: "INACTIVE" }, select: adminPackageSelect })))
  } catch { return internalErrorResponse() }
}
