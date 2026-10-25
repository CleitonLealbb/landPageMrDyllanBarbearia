"use client"

import { Banknote, CheckCircle2, CreditCard, Plus, QrCode, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Choice, Field } from "./fields"
import { methodLabel, money, paymentInput } from "../helpers"
import { paymentError, paymentRemaining, paymentSummary } from "../payment-draft"
import type { CheckoutController, CheckoutState } from "../controller"
import type { Method } from "../types"

const methods = [
  { method: "PIX", label: "PIX", Icon: QrCode },
  { method: "CREDIT_CARD", label: "Crédito", Icon: CreditCard },
  { method: "DEBIT_CARD", label: "Débito", Icon: CreditCard },
  { method: "CASH", label: "Dinheiro", Icon: Banknote },
] as const

export function Payments({ state, controller }: { state: CheckoutState; controller: CheckoutController }) {
  const locked = state.busy || state.retry
  const total = state.sale?.totalCents ?? 0
  const summary = paymentSummary(state.payments, total)
  const mixed = new Set(state.payments.map(payment => payment.method)).size > 1
  const complete = state.payments.length > 0 && summary.valid && summary.remainingCents === 0 && state.payments.every(payment => payment.confirmed)
  const addMixed = () => {
    const current = controller.getSnapshot().payments
    if (new Set(current.map(payment => payment.method)).size > 1) return
    if (!current.length) controller.addPayment("PIX")
    controller.addPayment(current[0]?.method === "CASH" ? "PIX" : "CASH")
  }

  return <section aria-label="Pagamentos" className="min-w-0 space-y-3 border-t border-border/60 pt-4">
    <div className="flex items-center justify-between gap-2"><h3 className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Formas de pagamento</h3>{mixed && <span className="rounded bg-primary/15 px-2 py-1 text-[9px] font-semibold uppercase text-primary">Pagamento misto</span>}</div>
    <div role="group" aria-label="Adicionar forma de pagamento" className="grid grid-cols-5 gap-1">{methods.map(({ method, label, Icon }) => <Button key={method} type="button" variant="outline" className="h-10 min-w-0 flex-col gap-0.5 rounded-md px-1 text-[9px] hover:border-primary/60 hover:bg-primary/10 hover:text-primary" aria-label={`Adicionar pagamento em ${methodLabel[method]}`} disabled={locked || state.payments.length >= 20} onClick={() => controller.addPayment(method)}><Icon className="h-4 w-4" aria-hidden="true" />{label}</Button>)}<Button type="button" variant={mixed ? "default" : "outline"} className="h-10 min-w-0 rounded-md px-1 text-[9px]" aria-label="Adicionar pagamento misto" aria-pressed={mixed} disabled={locked || state.payments.length >= 20} onClick={addMixed}>Misto</Button></div>
    <p className="text-[10px] leading-relaxed text-muted-foreground">Adicione uma ou mais formas e confirme cada recebimento. PIX e cartões são manuais, sem integração automática. Desconfirme um pagamento antes de editar.</p>
    {state.payments.map((payment, index) => {
      const error = paymentError(state.payments, total, payment.id)
      const remaining = paymentRemaining(state.payments, total, payment.id)
      const descriptionId = `payment-${payment.id}-details`
      const errorId = `payment-${payment.id}-error`
      const disabled = locked || payment.confirmed
      return <fieldset key={payment.id} disabled={locked} className="min-w-0 space-y-2 rounded-lg border border-border/50 bg-background/25 p-2.5"><legend className="px-1 text-[10px] text-muted-foreground">Pagamento {index + 1}</legend>
        {payment.reviewRequired && <p role="status" className="text-xs text-primary">Revisão necessária. A comanda foi alterada. Revise e confirme novamente os pagamentos.</p>}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"><Choice label={`Forma do pagamento ${index + 1}`} value={payment.method} disabled={disabled} onChange={event => controller.payment(payment.id, { method: event.target.value as Method })}>{Object.entries(methodLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Choice><Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" disabled={disabled} aria-label={`Remover pagamento ${index + 1}`} onClick={() => controller.removePayment(payment.id)}><Trash2 aria-hidden="true" /></Button></div>
        <div className={`grid min-w-0 gap-2 ${payment.method === "CASH" ? "grid-cols-1 min-[360px]:grid-cols-2" : "grid-cols-1"}`}><Field label={`Valor aplicado ${index + 1} (R$)`} value={payment.amount} inputMode="decimal" disabled={disabled} aria-invalid={!!error} aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`} onChange={event => controller.payment(payment.id, { amount: event.target.value })} />{payment.method === "CASH" && <Field label={`Dinheiro recebido ${index + 1} (R$)`} value={payment.received} inputMode="decimal" disabled={disabled} aria-invalid={!!error} aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`} onChange={event => controller.payment(payment.id, { received: event.target.value })} />}</div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><p id={descriptionId} className="min-w-0 text-[10px] leading-relaxed text-muted-foreground">{payment.confirmed ? "Confirmado. Desconfirme para editar." : payment.amountMode === "AUTO" ? index === state.payments.length - 1 ? "Valor automático; acompanha o restante." : "Valor preenchido automaticamente." : "Valor editado manualmente."} {remaining === null ? "Conclua os valores dos outros pagamentos para calcular o restante." : `Disponível: ${money(remaining)}.`}</p><Button type="button" variant="link" className="h-auto min-h-8 whitespace-normal p-0 text-[10px]" disabled={disabled || remaining === null} aria-label={`Usar valor restante no pagamento ${index + 1}`} onClick={() => controller.usePaymentRemaining(payment.id)}>Usar valor restante</Button></div>
        {payment.method === "CASH" && !payment.confirmed && <p className="text-[10px] leading-relaxed text-muted-foreground">{payment.receivedMode === "AUTO" ? "Dinheiro recebido acompanha o valor aplicado." : "Dinheiro recebido editado manualmente; confira o valor após mudar a divisão."}</p>}
        {error && <p id={errorId} role="alert" className="text-[11px] leading-relaxed text-destructive">{error}</p>}
        <label className={`flex items-center gap-2 rounded-md px-2 py-2 text-[11px] ${payment.confirmed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><input type="checkbox" className="h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" checked={payment.confirmed} disabled={locked || (!payment.confirmed && !!error)} aria-describedby={error ? errorId : descriptionId} onChange={event => controller.payment(payment.id, { confirmed: event.target.checked })} />Recebimento confirmado</label>
      </fieldset>
    })}
    <Button type="button" variant="ghost" className="h-9 w-full whitespace-normal border border-dashed border-border/70 text-xs text-muted-foreground" disabled={locked || state.payments.length >= 20} onClick={() => controller.addPayment()}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Adicionar pagamento / dividir valor</Button>
    <dl aria-label="Resumo dos pagamentos" aria-live="polite" aria-atomic="true" className="space-y-2 rounded-lg bg-muted/40 p-3 text-[11px]">
      <div className="flex justify-between gap-3"><dt>Total da venda</dt><dd className="tabular-nums">{money(total)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Total informado</dt><dd className="tabular-nums">{money(summary.appliedCents)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Total confirmado</dt><dd className="tabular-nums">{money(summary.confirmedCents)}</dd></div>
      <div className={`flex justify-between gap-3 ${summary.remainingCents !== 0 ? "text-primary" : "text-muted-foreground"}`}><dt>Valor restante</dt><dd className="tabular-nums">{money(summary.remainingCents)}</dd></div>
      {summary.excessCents > 0 && <div className="flex justify-between gap-3 text-destructive"><dt>Valor aplicado excedente</dt><dd className="tabular-nums">{money(summary.excessCents)}</dd></div>}
      <div className="flex justify-between gap-3 border-t border-border/60 pt-2 text-primary"><dt>Troco em dinheiro</dt><dd className="font-semibold tabular-nums">{money(summary.changeCents)}</dd></div>
    </dl>
    <p role="status" className="flex items-center gap-2 text-[11px] leading-relaxed text-muted-foreground">{complete ? <><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />Pagamento completo</> : summary.excessCents > 0 ? "Reduza o valor aplicado excedente. Somente dinheiro recebido pode gerar troco." : summary.remainingCents > 0 ? "Informe o valor restante e confirme cada recebimento para finalizar." : "Confira os valores e confirme cada recebimento para finalizar."}</p>
  </section>
}

export function FinalizeAction({ state, controller }: { state: CheckoutState; controller: CheckoutController }) {
  const locked = state.busy || state.retry || state.editing
  let error: string | null = null
  try { paymentInput(state.payments, state.sale?.totalCents ?? 0) } catch (cause) { error = cause instanceof Error ? cause.message : "Confira os pagamentos." }
  return <div className="space-y-2">
    <Button type="button" className="h-auto min-h-11 w-full whitespace-normal rounded-lg py-3 text-xs font-semibold" disabled={locked || !!error || !state.data?.openSessions.some(session => session.cashRegisterId === state.registerId)} onClick={() => { void controller.finalize() }}><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{state.busy ? "Processando…" : `Finalizar venda — ${money(state.sale?.totalCents ?? 0)}`}</Button>
    {!state.data?.openSessions.some(session => session.cashRegisterId === state.registerId) && <p className="text-[11px] text-primary">Selecione um caixa aberto para finalizar.</p>}
  </div>
}
