import { check } from "./errors"
import { multiply, percentage, positiveDuration, sum } from "./calculations"
import type { SaleView } from "./presentation"

// Reconcile persisted snapshots, never recalculate historical prices from the catalog.
export function reconcile(sale: SaleView) {
  const items = sale.saleItem_sale
  check(items.length > 0, 409, "Venda sem itens.")
  for (const item of items) {
    check(item.subtotalCents === multiply(item.unitPriceCents, item.quantity) && item.totalCents === item.subtotalCents - item.discountCents, 409, "Totais dos itens inconsistentes.")
    const components = item.saleServiceComponent_saleItem
    if (item.kind === "PRODUCT") {
      check(item.durationMinutesSnapshot === null && components.length === 0, 409, "Snapshot de produto inválido.")
      continue
    }
    positiveDuration(item.durationMinutesSnapshot)
    check(components.length > 0 && sum(components.map(c => c.allocatedGrossCents)) === item.subtotalCents && sum(components.map(c => c.allocatedDiscountCents)) === item.discountCents, 409, "Rateio inconsistente.")
    const units = Array.from({ length: item.quantity }, (_, index) => components.filter(c => c.unitOrdinal === index + 1))
    check(units.every(unit => item.kind === "SERVICE" ? unit.length === 1 : unit.length >= 2), 409, "Composição histórica incompleta.")
    for (const component of components) {
      positiveDuration(component.durationMinutesSnapshot)
      check(component.commissionBaseCents === component.allocatedGrossCents - component.allocatedDiscountCents && component.commissionCents === percentage(component.commissionBaseCents, component.commissionBasisPoints), 409, "Comissão histórica inconsistente.")
    }
  }
  check(sale.servicesSubtotalCents === sum(items.filter(i => i.kind !== "PRODUCT").map(i => i.subtotalCents)) && sale.productsSubtotalCents === sum(items.filter(i => i.kind === "PRODUCT").map(i => i.subtotalCents)) && sale.discountCents === sum(items.map(i => i.discountCents)) && sale.tipCents === sum(sale.saleTip_sale.map(t => t.amountCents)) && sale.totalCents === sum([...items.map(i => i.totalCents), sale.tipCents]), 409, "Totais históricos inconsistentes.")
}
