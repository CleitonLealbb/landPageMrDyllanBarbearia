import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { barbershopNotFound, findActiveBarbershop, publicInternalError } from "@/lib/mobile/public-catalog"
import { packageServiceSelect } from "@/lib/services/packages"

type Context = { params: Promise<{ slug: string }> }
export async function GET(_request: Request, context: Context) {
  try {
    const { slug } = await context.params; const shop = await findActiveBarbershop(slug); if (!shop) return barbershopNotFound()
    const rows = await prisma.servicePackage.findMany({ where: { barbershopId: shop.id, status: "ACTIVE", items: { every: { service: { status: "ACTIVE" } } } }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, description: true, priceCents: true, displayOrder: true, items: { orderBy: { displayOrder: "asc" }, select: { service: { select: packageServiceSelect } } } } })
    return NextResponse.json(rows.filter((row) => row.items.length >= 2).map((row) => { const services = row.items.map((item) => item.service).map(({ status: _status, ...service }) => service); return { id: row.id, name: row.name, description: row.description, priceCents: row.priceCents, originalPriceCents: services.reduce((sum, service) => sum + service.priceCents, 0), durationMinutes: services.reduce((sum, service) => sum + service.durationMinutes, 0), displayOrder: row.displayOrder, services } }))
  } catch { return publicInternalError() }
}
