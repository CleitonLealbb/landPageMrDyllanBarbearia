import { amount, CheckoutInputError } from "./helpers"
import { formatPaymentCents } from "./payment-draft"
import type { CartLine, Sale } from "./types"

export function draftTipValue(state: { tip: string; extraTips?: { amountCents: number }[] }) {
  return formatPaymentCents((state.extraTips ?? []).reduce((sum, tip) => sum + tip.amountCents, amount(state.tip || "0")))
}

// Hydrate from persisted snapshots, never from current catalog prices/composition.
export function pendingDraft(sale: Sale) {
  if (sale.status !== "PENDING") throw new CheckoutInputError("Somente comandas pendentes podem ser editadas.")
  if (sale.tips.some(tip => !tip.professionalId)) throw new CheckoutInputError("Atualize os profissionais das gorjetas antes de editar.")
  const lines: CartLine[] = sale.items.map(item => {
    const catalogId = item.kind === "SERVICE" ? item.serviceId : item.kind === "PACKAGE" ? item.packageId : item.productId
    if (!catalogId || item.unitPriceCents === undefined) throw new CheckoutInputError("Atualize a comanda antes de editar seus snapshots.")
    const assignments = [...new Map(item.components.map(component => {
      if (!component.serviceId || !component.professionalId) throw new CheckoutInputError("Profissional ou serviço indisponível para edição.")
      return [component.serviceId, { serviceId: component.serviceId, name: component.serviceNameSnapshot, professionalId: component.professionalId }] as const
    })).values()]
    if (item.components.some(component => assignments.find(assignment => assignment.serviceId === component.serviceId)?.professionalId !== component.professionalId)) throw new CheckoutInputError("Este item possui profissionais diferentes por unidade. A edição exige revisão individual pelo responsável.")
    return { key: item.id, persistedId: item.id, kind: item.kind, catalogId, name: item.nameSnapshot, priceCents: item.unitPriceCents, durationMinutes: item.durationMinutesSnapshot, quantity: item.quantity, assignments }
  })
  return { lines, customer: sale.customerId ? { id: sale.customerId, name: "Cliente vinculado à venda" } : null,
    discountKind: sale.discountKind === "MANUAL_PERCENT" ? "PERCENT" as const : "FIXED" as const,
    discount: sale.discountKind === "MANUAL_PERCENT" ? formatPaymentCents(sale.discountBasisPoints ?? 0) : sale.discountCents ? formatPaymentCents(sale.discountCents) : "",
    tip: sale.tips[0] ? formatPaymentCents(sale.tips[0].amountCents) : "", tipProfessionalId: sale.tips[0]?.professionalId ?? "",
    extraTips: sale.tips.slice(1).map(tip => {
      if (!tip.professionalId) throw new CheckoutInputError("Atualize os profissionais das gorjetas antes de editar.")
      return { professionalId: tip.professionalId, amountCents: tip.amountCents }
    }) }
}

export function financialSnapshot(sale: Sale) {
  return JSON.stringify({ items: sale.items.map(item => ({ kind: item.kind, serviceId: item.serviceId, packageId: item.packageId, productId: item.productId, quantity: item.quantity, totalCents: item.totalCents,
    components: item.components.map(component => ({ serviceId: component.serviceId, professionalId: component.professionalId, allocatedGrossCents: component.allocatedGrossCents, allocatedDiscountCents: component.allocatedDiscountCents,
      commissionBaseCents: component.commissionBaseCents, commissionBasisPoints: component.commissionBasisPoints, commissionCents: component.commissionCents })) })), discountCents: sale.discountCents, tips: sale.tips, totalCents: sale.totalCents })
}
