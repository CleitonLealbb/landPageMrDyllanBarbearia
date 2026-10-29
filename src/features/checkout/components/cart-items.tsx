"use client"
import { displayName } from "../display"
import { Minus, Plus, Scissors, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Choice } from "./fields"
import { money } from "../helpers"
import type { CheckoutController, CheckoutState } from "../controller"

export function CartItems({ state, controller }: { state: CheckoutState; controller: CheckoutController }) {
  const data = state.data!, editable = controller.editable()
  return <div className="min-w-0 space-y-3" aria-label="Itens da comanda">
    {state.sale && !state.editing ? state.sale.items.map(item => <article key={item.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
      <p className="text-[9px] font-semibold uppercase text-muted-foreground">{item.kind === "PRODUCT" ? "Produto" : item.kind === "PACKAGE" ? "Combo" : "Serviço"}</p>
      <div className="flex justify-between gap-3 text-xs"><h3 className="min-w-0 break-words font-medium">{item.quantity} × {displayName(item.nameSnapshot, "Item")}</h3><strong className="shrink-0 tabular-nums text-primary">{money(item.totalCents)}</strong></div>
      {item.durationMinutesSnapshot !== null && <p className="text-[11px] text-muted-foreground">{item.durationMinutesSnapshot} min por unidade</p>}
      {item.components.map((component, index) => <p key={index} className="text-[11px] text-muted-foreground">{displayName(component.serviceNameSnapshot, "Serviço")} · {displayName(component.professionalNameSnapshot, "Profissional")}</p>)}
    </article>) : state.lines.map(line => {
      const max = line.kind === "PRODUCT" ? Math.min(100, data.products.find(product => product.id === line.catalogId)?.availableQuantity ?? 0) : 100
      return <article key={line.key} className="space-y-2 rounded-xl border border-border bg-card p-3">
        {state.editing && <p className="text-[10px] text-muted-foreground">{line.persistedId ? "Item persistido · alterações pendentes de salvar" : "Novo item · ainda não salvo"}</p>}
        <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="mb-1 text-[9px] font-semibold uppercase text-muted-foreground">{line.kind === "PRODUCT" ? "Produto" : line.kind === "PACKAGE" ? "Combo" : "Serviço"}</p><h3 className="break-words text-xs font-medium leading-snug">{displayName(line.name, "Item")}</h3>{line.durationMinutes !== null && <p className="mt-1 text-[10px] text-muted-foreground">{line.durationMinutes} min por unidade</p>}</div><strong className="shrink-0 pt-1 text-xs tabular-nums text-primary">{money(line.priceCents * line.quantity)}</strong><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary" disabled={!editable} aria-label={`Remover ${displayName(line.name, "Item")}`} onClick={() => controller.remove(line.key)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button></div>
        <div className="flex items-center justify-between gap-3"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Quantidade</span><div className="flex items-center rounded-lg border border-border/70 bg-background/60"><Button size="icon" variant="ghost" className="h-8 w-8 rounded-r-none" disabled={!editable || line.quantity <= 1} aria-label={`Diminuir quantidade de ${displayName(line.name, "Item")}`} onClick={() => controller.quantity(line.key, line.quantity - 1)}><Minus aria-hidden="true" /></Button><label><span className="sr-only">Quantidade de {displayName(line.name, "Item")}</span><Input className="h-8 w-14 rounded-none border-y-0 text-center text-xs tabular-nums focus-visible:ring-2" type="number" min={1} max={100} value={line.quantity} disabled={!editable} onChange={event => controller.quantity(line.key, Number(event.target.value))} /></label><Button size="icon" variant="ghost" className="h-8 w-8 rounded-l-none" disabled={!editable || line.quantity >= max} aria-label={`Aumentar quantidade de ${displayName(line.name, "Item")}`} onClick={() => controller.quantity(line.key, line.quantity + 1)}><Plus aria-hidden="true" /></Button></div></div>
        {line.assignments.map(assignment => <div key={assignment.serviceId} className="flex items-end gap-2"><Scissors className="mb-2.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0 flex-1"><Choice label={`Profissional • ${displayName(assignment.name, "Serviço")}`} className="h-8 text-xs" value={assignment.professionalId} disabled={!editable || data.operator.role === "BARBER"} onChange={event => controller.assign(line.key, assignment.serviceId, event.target.value)}><option value="">Selecione um profissional</option>{data.professionals.filter(pro => pro.serviceIds.includes(assignment.serviceId)).map(pro => <option key={pro.id} value={pro.id}>{displayName(pro.name, "Profissional")}</option>)}</Choice></div></div>)}
      </article>
    })}
  </div>
}
