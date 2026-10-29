import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { money } from "../helpers"

export const historyStatus: Record<string, string> = { DRAFT: "Rascunho", PENDING: "Pendente", PAID: "Finalizada", VOIDED: "Descartada", CANCELED: "Cancelada", OPEN: "Aberto", CLOSED: "Fechado", RECORDED: "Registrado", REFUNDED: "Estornado", PARTIALLY_REFUNDED: "Estorno parcial", POSTED: "Lançada", REVERSED: "Revertida" }
export const movementLabels: Record<string, string> = { OPENING: "Abertura", SUPPLY: "Suprimento", WITHDRAWAL: "Sangria", SALE: "Venda", REVERSAL: "Reversão", ENTRY: "Entrada", ADJUSTMENT: "Ajuste", EARNED: "Comissão original" }
export function historySaleStatus(sale: { status: string; closureKind?: string | null }) { return sale.closureKind === "LEGACY_VOIDED" ? "Descartada (legado)" : historyStatus[sale.status] }
export function historyDate(value: string | null, timezone: string) { return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—" }
export function HistoryBadge({ sale }: { sale: { status: string; closureKind?: string | null } }) {
  const discarded = sale.status === "VOIDED" || sale.closureKind === "LEGACY_VOIDED"
  return <Badge variant="outline" className={`max-w-full whitespace-normal text-[10px] ${discarded ? "text-muted-foreground" : sale.status === "CANCELED" ? "border-destructive/30 bg-destructive/5 text-destructive" : sale.status === "PAID" ? "border-primary/30 bg-primary/5 text-primary" : "bg-muted"}`}>{historySaleStatus(sale)}</Badge>
}
export function HistoryMetric({ label, value }: { label: string; value: number | null }) {
  return <div className="flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-1 py-1"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{value === null ? "—" : money(value)}</dd></div>
}
export function HistorySection({ label, name = label, open = false, children }: { label: string; name?: string; open?: boolean; children: ReactNode }) {
  return <details open={open} aria-label={name} className="group rounded-lg border border-border bg-card/50"><summary className="cursor-pointer rounded-lg px-3 py-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}</summary><div className="space-y-3 border-t border-border/60 p-3 text-xs leading-relaxed">{children}</div></details>
}
