"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Choice, Field } from "./fields"
import { CashHistoryContent, SaleHistoryContent } from "./history-detail"
import { HistoryBadge } from "./history-format"
import { saleHistoryActions, shortSaleId, type HistoryAction } from "../history-actions"
import { displayName } from "../display"
import type { CheckoutHistoryController, HistoryState } from "../history-controller"
import type { Bootstrap } from "../types"
import type { SaleHistoryDetail } from "../history-types"

export function HistorySaleActionButtons({ sale, data, disabled, onAction }: { sale: SaleHistoryDetail; data: Bootstrap; disabled: boolean; onAction: (action: HistoryAction) => void }) {
  return <>{saleHistoryActions(sale, data.operator.permissions).filter(item => item.action !== "details").map(item => <Button key={item.action} size="sm" variant={item.action === "discard" || item.action === "cancel" ? "destructive" : "outline"} className="h-auto min-h-9 whitespace-normal text-xs" disabled={disabled} onClick={() => onAction(item.action)}>{item.label}</Button>)}</>
}
export function HistoryDetailSheet({ state, controller, data, onAction, onMutation, blockedSaleId }: {
  state: HistoryState; controller: CheckoutHistoryController; data: Bootstrap; onAction: (id: string, action: HistoryAction) => void; onMutation?: (id: string) => void; blockedSaleId?: string
}) {
  const sale = state.saleDetail, cash = state.cashDetail, locked = state.actionBusy || state.actionRetry
  return <>
    <Sheet open={state.detailOpen} onOpenChange={open => { if (!open) controller.closeDetail() }}><SheetContent side="right" className="flex h-[100dvh] w-full min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-xl sm:p-0" data-testid="history-detail-sheet">
      <SheetHeader className="shrink-0 border-b border-border bg-background px-4 py-4 pr-12 text-left"><SheetTitle className="text-sm">{state.detailKind === "sales" ? "Detalhe da venda" : "Detalhe e conferência do caixa"}</SheetTitle><SheetDescription className="text-xs">Snapshots e lançamentos históricos preservados.</SheetDescription>{sale && state.detailKind === "sales" && <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{shortSaleId(sale.id)}</span><HistoryBadge sale={sale} /></div>}</SheetHeader>
      <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain p-3 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]" data-testid="history-detail-scroll" aria-busy={state.detailLoading}>
        {state.detailLoading ? <p role="status" className="p-4 text-xs">Carregando detalhes…</p> : state.detailError ? <HistoryError message={state.detailError} status={state.detailStatus} retry={() => { void controller.loadDetail() }} /> : state.detailKind === "sales" && sale ? <SaleHistoryContent data={sale} focusReversals={state.focusReversals} /> : cash ? <CashHistoryContent data={cash} page={state.movementPage} loading={state.detailLoading} onNext={() => { void controller.nextMovements() }} onPrevious={() => { void controller.previousMovements() }} onSale={id => { void controller.openLinkedSale(id) }} showPagination={false} /> : null}
        {state.actionError && !state.action && <p role="alert" className="text-xs text-destructive">{state.actionError}</p>}
      </div>
      <footer aria-label="Ações do detalhe histórico" className="z-10 flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {state.detailKind === "sales" && sale && !state.detailLoading && !state.detailError && <HistorySaleActionButtons sale={sale} data={data} disabled={locked || blockedSaleId === sale.id} onAction={action => onAction(sale.id, action)} />}
        {state.detailKind === "sales" && controller.kind === "cash-sessions" && <Button size="sm" variant="outline" disabled={locked} onClick={() => { void controller.backToCash() }}>Voltar à conferência</Button>}
        {state.detailKind === "cash-sessions" && cash && <><Button size="sm" variant="outline" disabled={state.detailLoading || state.movementPage === 1} onClick={() => { void controller.previousMovements() }}>Movimentos anteriores</Button><span className="text-xs">Página {state.movementPage}</span><Button size="sm" variant="outline" disabled={state.detailLoading || !cash.movements.hasMore} onClick={() => { void controller.nextMovements() }}>Próximos movimentos</Button></>}
        <Button size="sm" variant="ghost" disabled={locked} onClick={() => controller.closeDetail()}>Fechar detalhes</Button>
      </footer>
    </SheetContent></Sheet>
    <Dialog open={state.action !== null} onOpenChange={open => { if (!open) controller.closeAction() }}><DialogContent>{state.action && sale && <HistoryActionConfirmation key={`${sale.id}:${state.action}`} state={state} controller={controller} data={data} onMutation={onMutation} />}</DialogContent></Dialog>
  </>
}
export function HistoryActionConfirmation({ state, controller, data, onMutation }: { state: HistoryState; controller: CheckoutHistoryController; data: Bootstrap; onMutation?: (id: string) => void }) {
  const [reason, setReason] = useState(""), [sessionId, setSessionId] = useState(data.openSessions[0]?.id ?? "")
  const discard = state.action === "discard", locked = state.actionBusy || state.actionRetry
  const needsCash = !discard && state.saleDetail?.payments.some(payment => payment.method === "CASH" && payment.appliedCents > 0)
  const complete = (result: { id: string } | null) => { if (result) onMutation?.(result.id) }
  return <><DialogHeader><DialogTitle>{discard ? "Descartar comanda?" : "Cancelar venda integralmente?"}</DialogTitle><DialogDescription>{discard ? "Esta comanda ainda não foi paga. Nenhuma movimentação financeira será realizada. Os snapshots serão preservados." : "O servidor reverterá os lançamentos aplicáveis. Para devolver dinheiro, selecione um caixa aberto com saldo suficiente. Confirme a devolução externa pelos procedimentos operacionais existentes."}</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void controller.confirmAction(reason, needsCash ? sessionId : undefined).then(complete) }}>
      <Field label={discard ? "Motivo do descarte" : "Motivo do cancelamento"} value={reason} onChange={event => setReason(event.target.value)} required maxLength={500} disabled={locked} />
      {needsCash && <Choice label="Caixa aberto para devolução" value={sessionId} onChange={event => setSessionId(event.target.value)} disabled={locked} required><option value="">Selecione um caixa aberto</option>{data.openSessions.map(session => <option key={session.id} value={session.id}>{displayName(data.cashRegisters.find(register => register.id === session.cashRegisterId)?.name ?? "Caixa", "Caixa")} · Aberto</option>)}</Choice>}
      {needsCash && !data.openSessions.length && <p role="alert" className="text-xs text-destructive">Abra um caixa na operação do Checkout para devolver dinheiro.</p>}
      {state.actionError && <p role="alert" className="text-xs text-destructive">{state.actionError}</p>}
      {state.actionRetry && <div className="space-y-2 text-xs"><p>A resposta é incerta. Repita a mesma requisição com segurança; o conteúdo está bloqueado.</p><Button type="button" variant="outline" disabled={state.actionBusy} onClick={() => { void controller.retryAction().then(complete) }}>Repetir operação com segurança</Button></div>}
      <DialogFooter><Button type="button" variant="outline" disabled={locked} onClick={() => controller.closeAction()}>Voltar</Button><Button type="submit" variant="destructive" disabled={locked || !reason.trim() || !!needsCash && !sessionId}>{state.actionBusy ? "Processando…" : discard ? "Confirmar descarte" : "Confirmar cancelamento"}</Button></DialogFooter>
    </form></>
}
export function HistoryError({ message, status, retry }: { message: string; status: number | null; retry: () => void }) {
  return <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 p-3 text-xs"><p>{message}</p>{status === 401 ? <a href="/login" className="underline">Entrar novamente</a> : <Button size="sm" variant="outline" onClick={retry}>Tentar novamente</Button>}</div>
}
