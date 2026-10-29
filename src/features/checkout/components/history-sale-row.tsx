"use client"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { displayName } from "../display"
import { methodLabel, money } from "../helpers"
import { saleHistoryActions, shortSaleId, type HistoryAction } from "../history-actions"
import type { Bootstrap } from "../types"
import type { SaleHistoryRow } from "../history-types"
import { HistoryBadge, historyDate } from "./history-format"

export function HistorySaleRow({ sale, zone, permissions, disabled, onAction }: { sale: SaleHistoryRow; zone: string; permissions: Bootstrap["operator"]["permissions"]; disabled: boolean; onAction: (action: HistoryAction) => void }) {
  const label = shortSaleId(sale.id), professionals = sale.professionals.length > 1 ? `Múltiplos profissionais (${sale.professionals.length})` : sale.professionals[0] ? displayName(sale.professionals[0].name, "Profissional") : "Venda de produtos"
  return <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card/40 px-3 py-2.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto]" aria-label={`Venda ${label}`}>
    <button type="button" disabled={disabled} className="min-w-0 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Ver detalhes da venda ${label}`} onClick={() => onAction("details")}><p className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground"><span className="font-mono">{label}</span><time>{historyDate(sale.createdAt, zone)}</time></p><p className="truncate text-xs font-medium" title={sale.customer?.name}>{sale.customer ? displayName(sale.customer.name, "Cliente") : "Cliente não identificado"}</p><p className="truncate text-[10px] text-muted-foreground" title={sale.professionals.map(p => displayName(p.name, "Profissional")).join(", ")}>{professionals} · {sale.itemCount} itens</p></button>
    <p className="col-span-3 row-start-2 text-[10px] text-muted-foreground sm:col-span-1 sm:row-start-auto">{sale.paymentMethods.length ? sale.paymentMethods.map(method => methodLabel[method]).join(" · ") : "Sem pagamento registrado"}</p>
    <div className="col-start-2 row-start-1 space-y-1 text-right sm:col-start-3"><p className="text-xs font-semibold tabular-nums text-primary">{money(sale.totalCents)}</p><HistoryBadge sale={sale} /></div>
    <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" className="col-start-3 row-start-1 h-8 w-8 sm:col-start-4" disabled={disabled} aria-label={`Ações da venda ${label}`}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{saleHistoryActions(sale, permissions).map(item => <DropdownMenuItem key={item.action} className={item.action === "discard" || item.action === "cancel" ? "text-destructive" : ""} onSelect={() => onAction(item.action)}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
  </article>
}
