import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { internalErrorResponse, isPrismaUniqueError, requireCatalogOwner } from "@/lib/services/catalog"
import { adminPackageSelect, presentPackage, validatePackageBody } from "@/lib/services/packages"

export async function GET() {
  try {
    const auth = await requireCatalogOwner(); if (auth.response) return auth.response
    const rows = await prisma.servicePackage.findMany({ where: { barbershopId: auth.owner.barbershopId }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: adminPackageSelect })
    return NextResponse.json(rows.map(presentPackage))
  } catch { return internalErrorResponse() }
}

export async function POST(request: Request) {
  try {
    const auth = await requireCatalogOwner(); if (auth.response) return auth.response
    const validation = validatePackageBody(await request.json(), false)
    if (validation.error) return NextResponse.json({ message: validation.error }, { status: 400 })
    const data = validation.value!, barbershopId = auth.owner.barbershopId
    const services = await prisma.service.findMany({ where: { barbershopId, id: { in: data.serviceIds }, status: "ACTIVE" }, select: { id: true, priceCents: true } })
    if (services.length !== data.serviceIds!.length) return NextResponse.json({ message: "Selecione apenas servicos ativos desta barbearia." }, { status: 400 })
    if (data.priceCents! > services.reduce((sum, item) => sum + item.priceCents, 0)) return NextResponse.json({ message: "O preco promocional nao pode superar o valor original." }, { status: 400 })
    const row = await prisma.$transaction((tx) => tx.servicePackage.create({ data: { barbershopId, name: data.name!, description: data.description, priceCents: data.priceCents!, displayOrder: data.displayOrder, status: data.status, items: { create: data.serviceIds!.map((serviceId, displayOrder) => ({ barbershopId, serviceId, displayOrder })) } }, select: adminPackageSelect }))
    return NextResponse.json(presentPackage(row), { status: 201 })
  } catch (error) {
    if (isPrismaUniqueError(error)) return NextResponse.json({ message: "Ja existe um combo com este nome." }, { status: 409 })
    return internalErrorResponse()
  }
}
