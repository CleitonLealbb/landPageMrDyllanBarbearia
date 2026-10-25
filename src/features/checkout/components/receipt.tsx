"use client"
import { useState } from "react"
import { CheckCircle2, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "./fields"
import { CustomerPicker } from "./customer-picker"
import { CartItems } from "./cart-items"
import { CartAdjustments } from "./cart-adjustments"
import styles from "./receipt.module.css"
import { displayName } from "../display"
import { Payments, FinalizeAction } from "./payments"
import { estimate, methodLabel, money } from "../helpers"
import { draftTipValue } from "../pending-draft"
import type { CheckoutController, CheckoutState } from "../controller"

export function Receipt({ state, controller, mobile = false, onEdit }: { state: CheckoutState; controller: CheckoutController; mobile?: boolean; onEdit?: () => void }) {
  const [cancelOpen, setCancelOpen] = useState(false), [discardOpen, setDiscardOpen] = useState(false), [clearOpen, setClearOpen] = useState(false), [reason, setReason] = useState(""), [resumeId, setResumeId] = useState("")
  const data = state.data!, sale = state.editing ? null : state.sale, editable = controller.editable(), locked = state.busy || state.retry
  let preview = { subtotal: 0, discountCents: 0, tipCents: 0, totalCents: 0 }, invalid = false
  try { preview = estimate(state.lines, state.discountKind, state.discount, draftTipValue(state)) } catch { invalid = true }
  const servicesSubtotal = sale?.servicesSubtotalCents ?? state.lines.filter(line => line.kind !== "PRODUCT").reduce((sum, line) => sum + line.priceCents * line.quantity, 0)
  const productsSubtotal = sale?.productsSubtotalCents ?? state.lines.filter(line => line.kind === "PRODUCT").reduce((sum, line) => sum + line.priceCents * line.quantity, 0)
  const itemCount = sale ? sale.items.reduce((sum, item) => sum + item.quantity, 0) : state.lines.reduce((sum, line) => sum + line.quantity, 0)
  // Old idempotency responses predate closureKind; never reinterpret their stored status.
  const closure = sale?.closureKind ?? (sale?.status === "VOIDED" ? "VOIDED" : sale?.status === "CANCELED" ? sale.finalizedAt ? "CANCELED" : "LEGACY_VOIDED" : null)
  const discarded = closure === "VOIDED" || closure === "LEGACY_VOIDED"
  const closedAt = discarded ? sale?.voidedAt ?? sale?.canceledAt : sale?.canceledAt
  const closedBy = discarded ? sale?.voidedByName ?? sale?.canceledByName : sale?.canceledByName
  const closedReason = discarded ? sale?.voidReason ?? sale?.cancellationReason : sale?.cancellationReason

  return <aside id="checkout-receipt" tabIndex={-1} className={`flex min-w-0 flex-col overflow-hidden border-border bg-card/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mobile ? "h-full max-h-full" : "border-t md:max-h-[80dvh] lg:sticky lg:top-0 lg:h-[100dvh] lg:max-h-[100dvh] lg:border-l lg:border-t-0"}`} aria-label="Comanda de caixa">
    <header className="z-10 shrink-0 space-y-2 border-b border-border bg-background p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Comanda de caixa</h2><span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[9px] font-medium text-primary">{itemCount} ITENS</span></div>
      <ol aria-label="Etapas da venda" className="flex flex-wrap items-center gap-2 text-[10px] font-medium"><li aria-current={!sale ? "step" : undefined} className={!sale ? "text-primary" : "text-muted-foreground"}>1. Itens da comanda</li><li className="h-px flex-1 bg-border" aria-hidden="true" /><li aria-current={sale?.status === "PENDING" ? "step" : undefined} className={sale?.status === "PENDING" ? "text-primary" : "text-muted-foreground"}>2. Pagamento</li>{sale && <li className="rounded bg-muted px-2 py-1 font-semibold">{closure === "LEGACY_VOIDED" ? "Descartada (legado)" : ({ PENDING: "PENDENTE", PAID: "PAGA", VOIDED: "Descartada", CANCELED: "Cancelada", DRAFT: "RASCUNHO" })[sale.status]}</li>}</ol>
    </header>
    <div className={`${styles.scrollArea} min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4`} data-testid="receipt-scroll-area">
      {sale?.status === "PAID" && <p role="status" className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-primary">Venda finalizada com sucesso.</p>}
      {discarded && <section className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs" aria-label="Descarte da comanda"><p role="status">Comanda descartada. Nenhuma movimentação financeira foi realizada.</p>{closedReason && <p className="break-words"><span className="font-medium">Motivo: </span>{closedReason}</p>}{closedBy && <p><span className="font-medium">Responsável: </span>{displayName(closedBy, "Operador")}</p>}{closedAt && <p><span className="font-medium">Horário: </span><time dateTime={closedAt}>{new Date(closedAt).toLocaleString("pt-BR")}</time></p>}</section>}
      {closure === "CANCELED" && <p role="status" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">Venda cancelada. Os lançamentos aplicáveis foram revertidos.</p>}
      {state.editing && <p role="status" className="rounded-lg border border-primary/25 p-3 text-xs">Comanda PENDING em edição. Alterações ainda não salvas; os totais abaixo são estimados.</p>}
      <CustomerPicker state={state} controller={controller} />
      {!sale && !state.lines.length && <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center"><ClipboardList className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" aria-hidden="true" /><p className="text-sm font-medium">Sua comanda está vazia</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Selecione um serviço, combo ou produto para iniciar a venda.</p></div>}
      <CartItems state={state} controller={controller} />
      <CartAdjustments state={state} controller={controller} />


      {sale?.status === "PENDING" && <Payments state={state} controller={controller} />}
      {sale && <section className="space-y-3 border-t border-border/60 pt-4" aria-label="Ações da venda">

        {sale.status !== "PENDING" && <div className="space-y-2">{sale.tips.map((tip, index) => <p key={index} className="text-xs">Gorjeta ? {displayName(tip.professionalNameSnapshot, "Profissional")}: {money(tip.amountCents)}</p>)}{sale.payments.map(payment => <p key={payment.id} className="text-xs">{methodLabel[payment.method]}: {money(payment.appliedCents)}{payment.changeCents > 0 ? ` ? Troco ${money(payment.changeCents)}` : ""}{payment.refundedCents > 0 ? ` ? Revertido ${money(payment.refundedCents)}` : ""}</p>)}{data.operator.permissions.cancel && sale.status === "PAID" && <Button variant="ghost" size="sm" className="text-destructive" disabled={locked} onClick={() => { setReason(""); setCancelOpen(true) }}>Cancelar venda</Button>}</div>}
      </section>}
      {!sale && !state.lines.length && <details className="border-t border-border/60 pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Recuperar venda</summary><form className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); void controller.resume(resumeId) }}><Field label="Código da venda" value={resumeId} onChange={event => setResumeId(event.target.value)} maxLength={100} disabled={locked} required /><Button size="sm" variant="outline" disabled={locked} type="submit">Consultar e retomar</Button></form></details>}
      <p className="flex items-start gap-2 border-t border-border/60 pt-3 text-[10px] leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />{discarded ? "Comanda encerrada antes do pagamento. Os itens e valores foram preservados para consulta." : closure === "CANCELED" ? "Venda encerrada. Consulte os lançamentos e suas reversões no histórico." : sale?.status === "PAID" ? "Venda confirmada pelo servidor. Consulte o Dashboard para os resultados." : "A finalização revalida o estoque e confirma os lançamentos no servidor."}</p>
    </div>
    <footer aria-label="Ação principal da comanda" className="sticky bottom-0 z-10 shrink-0 space-y-3 border-t border-border bg-background p-3 sm:p-4">
      <dl className="space-y-1.5 text-[11px]">
        <div className="flex justify-between gap-3 text-muted-foreground"><dt>Subtotal serviços e combos</dt><dd className="shrink-0 tabular-nums text-foreground">{money(servicesSubtotal)}</dd></div>
        <div className="flex justify-between gap-3 text-muted-foreground"><dt>Subtotal produtos</dt><dd className="shrink-0 tabular-nums text-foreground">{money(productsSubtotal)}</dd></div>
        <div className="flex justify-between gap-3 text-primary"><dt>Desconto</dt><dd className="shrink-0 tabular-nums">− {money(sale?.discountCents ?? preview.discountCents)}</dd></div>
        <div className="flex justify-between gap-3 text-muted-foreground"><dt>Gorjeta</dt><dd className="shrink-0 tabular-nums text-foreground">+ {money(sale?.tipCents ?? preview.tipCents)}</dd></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2"><dt className="text-[11px] font-semibold uppercase tracking-wider">{sale ? "Total confirmado" : "Total estimado"}</dt><dd className="text-xl font-bold tracking-tight text-primary">{invalid && !sale ? "—" : money(sale?.totalCents ?? preview.totalCents)}</dd></div>
      </dl>
      {!sale && <div className="space-y-1.5"><Button className="h-auto min-h-11 w-full whitespace-normal py-2 rounded-lg text-xs font-semibold" disabled={!editable || !state.lines.length || invalid} onClick={() => { void controller.create() }}>{state.busy ? "Processando…" : state.editing ? "Salvar alterações e voltar ao pagamento" : "Criar comanda e ir ao pagamento"}</Button>{state.editing ? <Button variant="outline" className="w-full" disabled={locked} onClick={() => controller.cancelEdit()}>Cancelar alterações</Button> : <Button variant="ghost" className="w-full text-xs text-destructive" disabled={!editable} onClick={() => { if (state.lines.length) setClearOpen(true); else controller.clearCart() }}>Limpar comanda</Button>}<p className="text-[10px] leading-relaxed text-muted-foreground">O servidor recalcula preços, composição, desconto e gorjeta. O pagamento usa o total confirmado pelo servidor.</p></div>}
      {sale?.status === "PENDING" && <div className="space-y-1.5"><FinalizeAction state={state} controller={controller} /><Button variant="outline" className="min-h-9 w-full whitespace-normal text-xs" disabled={locked} onClick={() => { controller.beginEdit(); if (controller.getSnapshot().editing) onEdit?.() }}>Voltar e editar comanda</Button><p className="text-[10px] text-muted-foreground">Adicione ou remova itens antes de finalizar.</p>{data.operator.permissions.sell && <Button variant="ghost" className="min-h-9 w-full whitespace-normal text-xs text-destructive" disabled={locked} onClick={() => { setReason(""); setDiscardOpen(true) }}>Descartar comanda</Button>}</div>}
        {sale && ["PAID", "VOIDED", "CANCELED"].includes(sale.status) && <Button className="h-11 w-full rounded-xl" disabled={locked} onClick={() => controller.newSale()}>Nova venda</Button>}
    </footer>
    <Dialog open={clearOpen && !sale} onOpenChange={open => { if (!locked) setClearOpen(open) }}><DialogContent><ClearConfirmation state={state} controller={controller} onClose={() => setClearOpen(false)} /></DialogContent></Dialog>
    <Dialog open={discardOpen && sale?.status === "PENDING"} onOpenChange={open => { if (!locked) setDiscardOpen(open) }}><DialogContent><DiscardConfirmation state={state} controller={controller} reason={reason} onReasonChange={setReason} onClose={() => setDiscardOpen(false)} /></DialogContent></Dialog>
    <Dialog open={cancelOpen && sale?.status === "PAID"} onOpenChange={open => { if (!locked) setCancelOpen(open) }}><DialogContent><DialogHeader><DialogTitle>Cancelar venda integralmente?</DialogTitle><DialogDescription>Estoque, pagamentos, caixa e comissões serão revertidos pelo servidor. Para estornar dinheiro, selecione um caixa aberto com saldo suficiente.</DialogDescription></DialogHeader>{state.retry && <Button variant="outline" disabled={state.busy} onClick={() => { void controller.retry() }}>Repetir operação com segurança</Button>}<form className="space-y-4" onSubmit={event => { event.preventDefault(); void controller.cancel(reason).then(() => { if (controller.getSnapshot().sale?.status === "CANCELED") setCancelOpen(false) }) }}><Field label="Motivo do cancelamento" value={reason} required maxLength={500} disabled={locked} onChange={event => setReason(event.target.value)} />{state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}<DialogFooter><Button variant="outline" type="button" disabled={locked} onClick={() => setCancelOpen(false)}>Voltar</Button><Button variant="destructive" type="submit" disabled={locked || !reason.trim()}>Confirmar cancelamento</Button></DialogFooter></form></DialogContent></Dialog>
  </aside>
}

export function ClearConfirmation({ state, controller, onClose }: { state: CheckoutState; controller: CheckoutController; onClose: () => void }) {
  return <><DialogHeader><DialogTitle>Limpar comanda?</DialogTitle><DialogDescription>Os itens, cliente, desconto e gorjeta desta comanda serão removidos somente deste dispositivo. Nenhuma venda foi registrada.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={state.busy || state.retry} onClick={onClose}>Voltar</Button><Button variant="destructive" aria-label="Confirmar limpeza da comanda" disabled={!controller.editable()} onClick={() => { controller.clearCart(); onClose() }}>Confirmar limpeza</Button></DialogFooter></>
}

export function DiscardConfirmation({ state, controller, reason, onReasonChange, onClose }: { state: CheckoutState; controller: CheckoutController; reason: string; onReasonChange: (value: string) => void; onClose: () => void }) {
  const locked = state.busy || state.retry
  return <><DialogHeader><DialogTitle>Descartar comanda?</DialogTitle><DialogDescription>Esta comanda ainda não foi paga. Nenhuma movimentação financeira será realizada.</DialogDescription></DialogHeader>{state.retry && <Button variant="outline" disabled={state.busy} onClick={() => { void controller.retry() }}>Repetir operação com segurança</Button>}<form className="space-y-4" onSubmit={event => { event.preventDefault(); void controller.discard(reason).then(() => { if (controller.getSnapshot().sale?.status === "VOIDED") onClose() }) }}><Field label="Motivo do descarte" value={reason} required maxLength={500} disabled={locked} onChange={event => onReasonChange(event.target.value)} />{state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}<DialogFooter><Button variant="outline" type="button" disabled={locked} onClick={onClose}>Voltar</Button><Button variant="destructive" type="submit" disabled={locked || !reason.trim()}>Confirmar descarte</Button></DialogFooter></form></>
}
