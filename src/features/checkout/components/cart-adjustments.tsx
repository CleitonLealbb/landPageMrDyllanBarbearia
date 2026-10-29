"use client"
import { displayName } from "../display"
import { Choice, Field } from "./fields"
import type { CheckoutController, CheckoutState } from "../controller"

export function CartAdjustments({ state, controller }: { state: CheckoutState; controller: CheckoutController }) {
  const data = state.data!, editable = controller.editable()
  if (state.sale && !state.editing) return null
  return <div className="space-y-4 border-t border-border/60 pt-4">
    {state.extraTips?.map(tip => <p key={tip.professionalId} className="text-xs">Gorjeta adicional preservada: {(tip.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}<button type="button" className="ml-2 underline focus-visible:ring-2 focus-visible:ring-ring" disabled={!editable} onClick={() => controller.removeExtraTip(tip.professionalId)}>Remover gorjeta adicional</button></p>)}
    {data.operator.permissions.discount ? <details className="rounded-lg border border-border/50 p-3"><summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Desconto manual {state.discount ? "· informado" : "· opcional"}</summary><div className="mt-3 grid grid-cols-2 gap-2"><Choice label="Tipo de desconto" value={state.discountKind} disabled={!editable} onChange={event => controller.set({ discountKind: event.target.value as "FIXED" | "PERCENT" })}><option value="FIXED">Fixo (R$)</option><option value="PERCENT">Percentual (%)</option></Choice><Field label="Valor do desconto" inputMode="decimal" placeholder="0,00" disabled={!editable} value={state.discount} onChange={event => controller.set({ discount: event.target.value })} /></div></details> : <p className="text-[10px] text-muted-foreground">Desconto manual exclusivo do proprietário.</p>}
    <div><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Gorjeta do profissional</h3><div className="grid grid-cols-[minmax(80px,0.7fr)_minmax(0,1.3fr)] gap-2"><Field label="Gorjeta (R$)" inputMode="decimal" placeholder="0,00" disabled={!editable} value={state.tip} onChange={event => controller.set({ tip: event.target.value })} /><Choice label="Profissional da gorjeta" value={state.tipProfessionalId} disabled={!editable || data.operator.role === "BARBER"} onChange={event => controller.set({ tipProfessionalId: event.target.value })}><option value="">Selecione</option>{data.professionals.map(pro => <option value={pro.id} key={pro.id}>{displayName(pro.name, "Profissional")}</option>)}</Choice></div><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Gorjeta integral ao profissional, fora da base de comissão.</p></div>
  </div>
}
