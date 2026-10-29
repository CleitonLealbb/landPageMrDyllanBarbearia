import type { CheckoutDatabase } from "./client"
import { identity, type Context } from "./authorization"
import { canAccess } from "@/lib/permissions"
import type { Bootstrap, Service } from "@/features/checkout/types"

export async function bootstrap(client: CheckoutDatabase, ctx: Context, customerQuery: string): Promise<Bootstrap> {
  const who = await identity(client, ctx)
  const { barbershopId } = ctx
  const role = ctx.session.tenantRole
  const linked = who.ownProfessionalId ?? (ctx.session.type === "USER" ? (await client.professional.findFirst({ where: { barbershopId, userId: ctx.session.userId, status: "ACTIVE" }, select: { id: true } }))?.id ?? null : who.professionalId)
  const restricted = role === "BARBER"
  const [services, packages, professionals, products, registers, sessions, customers] = await Promise.all([
    client.service.findMany({ where: { barbershopId, status: "ACTIVE" }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, priceCents: true, durationMinutes: true, category: { select: { id: true, name: true, status: true } } } }),
    client.servicePackage.findMany({ where: { barbershopId, status: "ACTIVE", items: { every: { service: { status: "ACTIVE", barbershopId } } } }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, priceCents: true, durationMinutes: true, items: { orderBy: [{ displayOrder: "asc" }, { serviceId: "asc" }], select: { serviceId: true } } } }),
    client.professional.findMany({ where: { barbershopId, status: "ACTIVE", ...(restricted ? { id: linked! } : {}) }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, services: { where: { barbershopId, service: { status: "ACTIVE", barbershopId } }, select: { serviceId: true } } } }),
    client.product.findMany({ where: { barbershopId, status: "ACTIVE" }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, priceCents: true, inventoryBalance_product: { select: { quantity: true } } } }),
    client.cashRegister.findMany({ where: { barbershopId, active: true }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
    client.cashSession.findMany({ where: { barbershopId, status: "OPEN", cashRegister: { active: true, barbershopId } }, orderBy: { openedAt: "desc" }, select: { id: true, cashRegisterId: true, status: true, ...(!restricted ? { openedAt: true, openingBalanceCents: true, openedBy: { select: { nameSnapshot: true } } } : {}) } }),
    customerQuery ? client.barbershopCustomer.findMany({ where: { barbershopId, status: "ACTIVE", customerAccount: { name: { contains: customerQuery, mode: "insensitive" } } }, take: 20, orderBy: [{ customerAccount: { name: "asc" } }, { id: "asc" }], select: { id: true, customerAccount: { select: { name: true } } } }) : Promise.resolve([]),
  ])
  const activeServices: Service[] = services.map(s => ({ id: s.id, name: s.name, priceCents: s.priceCents, durationMinutes: s.durationMinutes, category: s.category?.status === "ACTIVE" ? { id: s.category.id, name: s.category.name } : null }))
  const enabled = new Set(professionals.flatMap(p => p.services.map(s => s.serviceId)))
  const visible = activeServices.filter(s => !restricted || enabled.has(s.id))
  const serviceMap = new Map(visible.map(s => [s.id, s]))
  return {
    operator: { id: who.userId ?? who.professionalId!, name: who.nameSnapshot, role, professionalId: linked,
      permissions: { sell: canAccess(role, "checkout:sales"), cash: canAccess(role, "checkout:cash"), discount: canAccess(role, "checkout:discount"), cancel: canAccess(role, "checkout:cancel") } },
    services: visible,
    packages: packages.filter(p => p.items.length >= 2 && p.items.every(i => serviceMap.has(i.serviceId))).map(p => ({ id: p.id, name: p.name, priceCents: p.priceCents, durationMinutes: p.durationMinutes, services: p.items.map(i => serviceMap.get(i.serviceId)!) })),
    professionals: professionals.map(p => ({ id: p.id, name: p.name, serviceIds: p.services.map(s => s.serviceId) })),
    products: products.map(p => ({ id: p.id, name: p.name, priceCents: p.priceCents, availableQuantity: Math.max(0, p.inventoryBalance_product?.quantity ?? 0) })),
    cashRegisters: registers.map(r => ({ id: r.id, name: r.name })),
    openSessions: sessions.map(s => restricted ? { id: s.id, cashRegisterId: s.cashRegisterId, status: "OPEN" } : { id: s.id, cashRegisterId: s.cashRegisterId, status: "OPEN", openedAt: s.openedAt!.toISOString(), openingBalanceCents: s.openingBalanceCents!, operatorName: s.openedBy!.nameSnapshot }),
    customers: customers.map(c => ({ id: c.id, name: c.customerAccount.name })),
  }
}
