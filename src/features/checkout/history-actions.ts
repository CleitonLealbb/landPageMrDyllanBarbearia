import type { Bootstrap, Sale } from "./types"

export type HistoryAction = "details" | "continue" | "edit" | "discard" | "cancel" | "reversals"
type State = Pick<Sale, "status"> & { closureKind?: Sale["closureKind"]; finalizedAt: string | null }
export function saleHistoryActions(sale: State, permissions: Bootstrap["operator"]["permissions"]) {
  if (sale.status === "VOIDED" || sale.closureKind === "LEGACY_VOIDED") return [{ action: "details" as const, label: "Ver detalhes do descarte" }]
  if (sale.status === "PENDING") return permissions.sell ? [
    { action: "continue" as const, label: "Continuar venda" }, { action: "edit" as const, label: "Editar comanda" }, { action: "discard" as const, label: "Descartar comanda" },
  ] : [{ action: "details" as const, label: "Ver detalhes" }]
  if (sale.status === "CANCELED") return [{ action: "details" as const, label: "Ver detalhes" }, { action: "reversals" as const, label: "Consultar reversões" }]
  return [{ action: "details" as const, label: "Ver detalhes" }, ...(sale.status === "PAID" && sale.finalizedAt && permissions.cancel ? [{ action: "cancel" as const, label: "Cancelar venda" }] : [])]
}
export function shortSaleId(id: string) { return `#${id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase()}` }
