import { Prisma } from "@prisma/client"
import type { Context } from "@/lib/checkout/authorization"
import type { SaleView } from "@/lib/checkout/presentation"
import { prismaMock as db } from "./prisma-mock"

export { db }
export const owner: Context = { barbershopId: "shop", session: { type: "USER", userId: "owner", globalRole: null, tenantRole: "BARBERSHOP_OWNER", barbershopId: "shop", sessionVersion: 0 } }
export function role(tenantRole: "BARBER" | "ASSISTANT"): Context {
  return { ...owner, session: { ...owner.session, tenantRole } }
}
export function serviceComponent() {
  return { id: "component", serviceId: "service", professionalId: "pro", serviceNameSnapshot: "Corte antigo", professionalNameSnapshot: "Nome antigo", durationMinutesSnapshot: 30, unitOrdinal: 1, componentOrdinal: 1, originalPriceCents: 1000, allocationWeightCents: 1000, allocatedGrossCents: 1000, allocatedDiscountCents: 0, commissionBaseCents: 1000, commissionBasisPoints: 4000, commissionCents: 400 }
}
export function sale(overrides: Partial<SaleView> = {}): SaleView {
  return { id: "sale", customerId: null, cashSessionId: null, origin: "WALK_IN", status: "PENDING", servicesSubtotalCents: 1000, productsSubtotalCents: 0, discountKind: "NONE", discountBasisPoints: null, discountCents: 0, tipCents: 0, totalCents: 1000, version: 0, createdAt: new Date("2026-10-22T12:00:00Z"), finalizedAt: null, canceledAt: null, cancellationReason: null, voidedAt: null, voidReason: null, voidedBy: null, canceledBy: null, saleTip_sale: [], payment_sale: [], saleItem_sale: [{ id: "item", kind: "SERVICE", serviceId: "service", productId: null, packageId: null, nameSnapshot: "Corte antigo", durationMinutesSnapshot: 30, unitPriceCents: 1000, originalUnitPriceCents: 1000, quantity: 1, subtotalCents: 1000, discountCents: 0, totalCents: 1000, saleServiceComponent_saleItem: [serviceComponent()] }], ...overrides }
}
export function productSale(): SaleView {
  const row = sale({ servicesSubtotalCents: 0, productsSubtotalCents: 1000 })
  row.saleItem_sale[0] = { ...row.saleItem_sale[0], kind: "PRODUCT", serviceId: null, productId: "product", durationMinutesSnapshot: null, saleServiceComponent_saleItem: [] }
  return row
}
export function knownError(code: string, rawCode?: string) {
  return new Prisma.PrismaClientKnownRequestError("SECRET SQL postgres password", { code, clientVersion: "6.6.0", meta: rawCode ? { code: rawCode, message: "SECRET" } : undefined })
}
export function setupCheckout() {
  db.$transaction.mockImplementation(async (...args: unknown[]) => (args[0] as (tx: Prisma.TransactionClient) => Promise<unknown>)(db as unknown as Prisma.TransactionClient))
  db.$queryRaw.mockResolvedValue([{ id: "locked" }])
  db.barbershopUser.findFirst.mockResolvedValue({ user: { name: "Operador" } })
  db.professional.findFirst.mockResolvedValue({ id: "pro", name: "Profissional" })
  db.checkoutIdempotency.findUnique.mockResolvedValue(null)
  db.checkoutActor.create.mockResolvedValue({ id: "actor" })
  db.checkoutAuditEvent.create.mockResolvedValue({ id: "audit" })
  db.checkoutIdempotency.create.mockResolvedValue({ id: "key" })
  db.cashRegister.findFirst.mockResolvedValue({ id: "register" })
  db.cashSession.findFirst.mockResolvedValue({ id: "cash", status: "OPEN" })
  db.cashSession.create.mockResolvedValue({ id: "cash", status: "OPEN" })
  db.cashSession.update.mockResolvedValue({ id: "cash", status: "CLOSED" })
  db.cashMovement.groupBy.mockResolvedValue([{ kind: "OPENING", _sum: { amountCents: 5000 } }])
  db.cashMovement.create.mockResolvedValue({ id: "cash-movement" })
  db.cashMovement.findMany.mockResolvedValue([])
  db.sale.findFirst.mockResolvedValue(sale())
  db.sale.findFirstOrThrow.mockResolvedValue(sale())
  db.sale.create.mockResolvedValue({ id: "sale" })
  db.sale.update.mockResolvedValue({ id: "sale" })
  db.sale.updateMany.mockResolvedValue({ count: 1 })
  db.saleItem.create.mockResolvedValue({ id: "item" })
  db.saleServiceComponent.createMany.mockResolvedValue({ count: 1 })
  db.saleTip.createMany.mockResolvedValue({ count: 1 })
  db.payment.create.mockResolvedValue({ id: "payment" })
  db.payment.update.mockResolvedValue({ id: "payment" })
  db.inventoryBalance.updateMany.mockResolvedValue({ count: 1 })
  db.inventoryMovement.createMany.mockResolvedValue({ count: 1 })
  db.inventoryMovement.create.mockResolvedValue({ id: "stock-reversal" })
  db.inventoryMovement.findMany.mockResolvedValue([])
  db.commissionEntry.createMany.mockResolvedValue({ count: 1 })
  db.commissionEntry.create.mockResolvedValue({ id: "commission-reversal" })
  db.commissionEntry.update.mockResolvedValue({ id: "commission" })
  db.commissionEntry.findMany.mockResolvedValue([])
  db.service.findMany.mockResolvedValue([{ id: "service", name: "Corte", priceCents: 1000, durationMinutes: 30 }])
  db.product.findMany.mockResolvedValue([{ id: "product", name: "Pomada", priceCents: 1000 }])
  db.servicePackage.findMany.mockResolvedValue([{ id: "package", name: "Combo", priceCents: 1001, durationMinutes: 50, items: [{ service: { id: "service", name: "Corte", priceCents: 1000, durationMinutes: 30, status: "ACTIVE" } }, { service: { id: "beard", name: "Barba", priceCents: 500, durationMinutes: 20, status: "ACTIVE" } }] }])
  db.professional.findMany.mockResolvedValue([{ id: "pro", name: "André", commission: 40, services: [{ serviceId: "service" }, { serviceId: "beard" }] }])
  db.barbershopCustomer.findFirst.mockResolvedValue({ id: "customer" })
}
