import { Prisma } from "@prisma/client"

export const saleSelect = {
  id: true, status: true, customerId: true, cashSessionId: true, origin: true, servicesSubtotalCents: true, productsSubtotalCents: true,
  discountKind: true, discountBasisPoints: true, discountCents: true, tipCents: true, totalCents: true, version: true,
  createdAt: true, finalizedAt: true, canceledAt: true, cancellationReason: true,
  voidedAt: true, voidReason: true,
  voidedBy: { select: { nameSnapshot: true } }, canceledBy: { select: { nameSnapshot: true } },
  saleItem_sale: { where: { removedAt: null }, orderBy: { id: "asc" }, select: {
    id: true, kind: true, serviceId: true, packageId: true, productId: true, nameSnapshot: true, durationMinutesSnapshot: true,
    unitPriceCents: true, originalUnitPriceCents: true, quantity: true, subtotalCents: true, discountCents: true, totalCents: true,
    saleServiceComponent_saleItem: { orderBy: [{ unitOrdinal: "asc" }, { componentOrdinal: "asc" }], select: {
      id: true, serviceId: true, professionalId: true, serviceNameSnapshot: true, professionalNameSnapshot: true, durationMinutesSnapshot: true,
      unitOrdinal: true, componentOrdinal: true, originalPriceCents: true, allocationWeightCents: true, allocatedGrossCents: true,
      allocatedDiscountCents: true, commissionBaseCents: true, commissionBasisPoints: true, commissionCents: true,
    } },
  } },
  saleTip_sale: { where: { removedAt: null }, select: { professionalId: true, professionalNameSnapshot: true, amountCents: true } },
  payment_sale: { select: { id: true, method: true, status: true, appliedCents: true, cashReceivedCents: true, changeCents: true, refundedCents: true, recordedAt: true, refundedAt: true } },
} satisfies Prisma.SaleSelect
export type SaleView = Prisma.SaleGetPayload<{ select: typeof saleSelect }>
export function saleClosureKind(row: { status: string; finalizedAt: Date | null }) {
  if (row.status === "VOIDED") return "VOIDED" as const
  if (row.status === "CANCELED") return row.finalizedAt === null ? "LEGACY_VOIDED" as const : "CANCELED" as const
  return null
}
export function presentSale(row: SaleView) {
  const { saleItem_sale: items, saleTip_sale: tips, payment_sale: payments, voidedBy, canceledBy, ...sale } = row
  return { ...sale, closureKind: saleClosureKind(row), voidedByName: voidedBy?.nameSnapshot ?? null, canceledByName: canceledBy?.nameSnapshot ?? null, items: items.map(({ saleServiceComponent_saleItem: components, ...item }) => ({ ...item, components })), tips, payments }
}
export const cashSelect = { id: true, cashRegisterId: true, status: true, shift: true, openingBalanceCents: true, expectedBalanceCents: true, countedBalanceCents: true, differenceCents: true, notes: true, openedAt: true, closedAt: true, version: true } satisfies Prisma.CashSessionSelect
export function json(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject
}
