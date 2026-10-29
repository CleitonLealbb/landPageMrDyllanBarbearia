import type { CheckoutDatabase } from "./client"
import type { SaleItem, SaleServiceComponent } from "@prisma/client"
import { allocate, commissionPoints, discountAmount, multiply, percentage, positiveDuration, sum } from "./calculations"
import { check } from "./errors"
import { allowDiscount, ownOperation, type Context, type Identity } from "./authorization"
import type { CreateSaleInput } from "./validation"

type Component = Omit<SaleServiceComponent, "id" | "barbershopId" | "saleItemId" | "createdAt">
type Item = Omit<SaleItem, "id" | "barbershopId" | "saleId" | "createdAt" | "removedAt" | "removedById" | "removedReason"> & { components: Component[] }
export async function snapshots(tx: CheckoutDatabase, ctx: Context, who: Identity, input: CreateSaleInput) {
  allowDiscount(ctx, input.discount)
  const barbershopId = ctx.barbershopId
  if (input.customerId) check(await tx.barbershopCustomer.findFirst({ where: { id: input.customerId, barbershopId, status: "ACTIVE" }, select: { id: true } }), 400, "Cliente inválido para esta barbearia.")
  const professionalIds = [...new Set([...input.items.flatMap(item => item.kind === "PRODUCT" ? [] : item.kind === "SERVICE" ? [item.professionalId] : item.components.map(component => component.professionalId)), ...input.tips.map(tip => tip.professionalId)])]
  const [services, products, packages, professionals] = await Promise.all([
    tx.service.findMany({ where: { barbershopId, id: { in: input.items.filter(item => item.kind === "SERVICE").map(item => item.catalogId) }, status: "ACTIVE" }, select: { id: true, name: true, priceCents: true, durationMinutes: true } }),
    tx.product.findMany({ where: { barbershopId, id: { in: input.items.filter(item => item.kind === "PRODUCT").map(item => item.catalogId) }, status: "ACTIVE" }, select: { id: true, name: true, priceCents: true } }),
    tx.servicePackage.findMany({ where: { barbershopId, id: { in: input.items.filter(item => item.kind === "PACKAGE").map(item => item.catalogId) }, status: "ACTIVE" }, select: { id: true, name: true, priceCents: true, durationMinutes: true, items: { orderBy: [{ displayOrder: "asc" }, { serviceId: "asc" }], select: { service: { select: { id: true, name: true, priceCents: true, durationMinutes: true, status: true } } } } } }),
    tx.professional.findMany({ where: { barbershopId, id: { in: professionalIds }, status: "ACTIVE" }, select: { id: true, name: true, commission: true, services: { select: { serviceId: true } } } }),
  ])
  function professional(id: string, serviceId?: string) {
    const row = professionals.find(row => row.id === id)
    check(row && (!serviceId || row.services.some(link => link.serviceId === serviceId)), 400, "Profissional inválido ou não habilitado para o serviço.")
    return row
  }
  const items: Item[] = input.items.map(item => {
    const catalog = item.kind === "PRODUCT" ? products.find(row => row.id === item.catalogId) : item.kind === "SERVICE" ? services.find(row => row.id === item.catalogId) : packages.find(row => row.id === item.catalogId)
    check(catalog, 400, "Item inválido ou inativo para esta barbearia.")
    const duration = item.kind === "PRODUCT" ? null : positiveDuration(item.kind === "SERVICE" ? services.find(row => row.id === item.catalogId)!.durationMinutes : packages.find(row => row.id === item.catalogId)!.durationMinutes)
    const source = item.kind === "PRODUCT" ? [] : item.kind === "SERVICE" ? [{ service: services.find(row => row.id === item.catalogId)!, professionalId: item.professionalId }] : (() => {
      const pack = packages.find(row => row.id === item.catalogId)!
      check(new Set(item.components.map(component => component.serviceId)).size === item.components.length && item.components.length === pack.items.length && pack.items.length >= 2, 400, "Composição do combo inválida.")
      return pack.items.map(({ service }) => {
        check(service.status === "ACTIVE", 400, "Combo contém serviço inativo.")
        const assignment = item.components.find(component => component.serviceId === service.id)
        check(assignment, 400, "Composição do combo inválida.")
        return { service, professionalId: assignment.professionalId }
      })
    })()
    const perUnit = source.length ? allocate(catalog.priceCents, source.map(row => row.service.priceCents)) : []
    const components: Component[] = []
    for (let unit = 1; unit <= item.quantity; unit++) source.forEach((row, index) => {
      const pro = professional(row.professionalId, row.service.id)
      components.push({ serviceId: row.service.id, professionalId: pro.id, serviceNameSnapshot: row.service.name, professionalNameSnapshot: pro.name,
        durationMinutesSnapshot: positiveDuration(row.service.durationMinutes), unitOrdinal: unit, componentOrdinal: index + 1,
        originalPriceCents: row.service.priceCents, allocationWeightCents: row.service.priceCents, allocatedGrossCents: perUnit[index], allocatedDiscountCents: 0,
        commissionBaseCents: perUnit[index], commissionBasisPoints: commissionPoints(pro.commission), commissionCents: 0 })
    })
    return { kind: item.kind, serviceId: item.kind === "SERVICE" ? item.catalogId : null, packageId: item.kind === "PACKAGE" ? item.catalogId : null,
      productId: item.kind === "PRODUCT" ? item.catalogId : null, nameSnapshot: catalog.name, durationMinutesSnapshot: duration,
      unitPriceCents: catalog.priceCents, originalUnitPriceCents: item.kind === "PACKAGE" ? sum(source.map(row => row.service.priceCents)) : catalog.priceCents,
      quantity: item.quantity, subtotalCents: multiply(catalog.priceCents, item.quantity), discountCents: 0, totalCents: 0, components }
  })
  const gross = sum(items.map(item => item.subtotalCents))
  const discountCents = discountAmount(gross, input.discount)
  const discounts = allocate(discountCents, items.map(item => item.subtotalCents))
  items.forEach((item, index) => {
    item.discountCents = discounts[index]; item.totalCents = item.subtotalCents - item.discountCents
    const componentsDiscount = item.components.length ? allocate(item.discountCents, item.components.map(component => component.allocatedGrossCents)) : []
    item.components.forEach((component, i) => {
      component.allocatedDiscountCents = componentsDiscount[i]
      component.commissionBaseCents = component.allocatedGrossCents - component.allocatedDiscountCents
      component.commissionCents = percentage(component.commissionBaseCents, component.commissionBasisPoints)
    })
  })
  const tips = input.tips.map(tip => ({ ...tip, professionalNameSnapshot: professional(tip.professionalId).name }))
  ownOperation(ctx, who, items.flatMap(item => item.components), tips)
  const tipCents = sum(tips.map(tip => tip.amountCents))
  return { items, tips, servicesSubtotalCents: sum(items.filter(item => item.kind !== "PRODUCT").map(item => item.subtotalCents)),
    productsSubtotalCents: sum(items.filter(item => item.kind === "PRODUCT").map(item => item.subtotalCents)), discountCents, tipCents,
    totalCents: sum([gross - discountCents, tipCents]),
    discountKind: !input.discount ? "NONE" as const : input.discount.kind === "FIXED" ? "MANUAL_FIXED" as const : "MANUAL_PERCENT" as const,
    discountBasisPoints: input.discount?.kind === "PERCENT" ? input.discount.basisPoints : null }
}
