"use client"
import { Button } from "@/components/ui/button"
import { displayName } from "../display"
import { money, methodLabel } from "../helpers"
import type { CashHistoryDetail } from "../history-types"
import { HistoryMetric as Metric, HistorySection, historyDate, historyStatus, movementLabels } from "./history-format"

export function CashHistoryContent({ data, page, loading, onNext, onPrevious, onSale, showPagination = true }: {
  data: CashHistoryDetail; page: number; loading: boolean; onNext: () => void; onPrevious: () => void; onSale?: (id: string) => void; showPagination?: boolean
}) {
  const s = data.session, zone = data.timezone
  return <div className="min-w-0 space-y-2">
    <HistorySection label="Resumo e conferência" name="Conferência do caixa" open>
      <p className="font-medium">{displayName(s.cashRegisterName, "Caixa")} · {historyStatus[s.status]}</p><p>Turno: {displayName(s.shift, "Turno registrado")}</p>
      <p>Abertura: {historyDate(s.openedAt, zone)} · {displayName(s.openedBy, "Operador")}</p><p>Fechamento: {historyDate(s.closedAt, zone)}{s.closedBy ? ` · ${displayName(s.closedBy, "Operador")}` : ""}</p>
      <dl><Metric label="Saldo inicial original" value={s.openingBalanceCents} /><Metric label="Saldo físico pelos movimentos" value={data.ledgerBalanceCents} /><Metric label="Saldo esperado no fechamento original" value={s.expectedBalanceCents} /><Metric label="Saldo contado original" value={s.countedBalanceCents} /><Metric label="Diferença original" value={s.differenceCents} /></dl>
      {s.status === "CLOSED" && <p className="text-muted-foreground">Fechamento histórico preservado. Esta tela não reabre o caixa nem registra ajustes.</p>}
      {s.status === "CLOSED" && s.expectedBalanceCents !== data.ledgerBalanceCents && <p role="alert" className="text-destructive">O saldo dos movimentos diverge do fechamento registrado. Nenhuma correção automática foi realizada.</p>}
      {data.notes && <p>Observação: {displayName(data.notes, "Observação registrada")}</p>}
    </HistorySection>
    <HistorySection label="Dinheiro e movimentos físicos" name="Totais dos movimentos" open>
      <p className="text-muted-foreground">Totais da sessão inteira, independentes da página de movimentos.</p>
      <dl><Metric label="Dinheiro originalmente recebido" value={data.cashReceivedCents} /><Metric label="Troco originalmente entregue" value={data.cashChangeCents} /><Metric label="Efeito líquido original em dinheiro" value={data.cashOriginalEffectCents} />
        {(["SUPPLY", "WITHDRAWAL", "REVERSAL"] as const).map(kind => <Metric key={kind} label={movementLabels[kind]} value={data.totals.find(t => t.kind === kind)?.amountCents ?? 0} />)}</dl>
      <p className="text-muted-foreground">Saldo físico: abertura + suprimentos + vendas em dinheiro − sangrias − reversões. PIX e cartões não são entradas físicas no caixa.</p>
      <p className="text-muted-foreground">Reversões físicas pertencem somente à sessão onde ocorreram. Um estorno em outro caixa não altera os movimentos nem o fechamento original desta sessão.</p>
    </HistorySection>
    <HistorySection label="Pagamentos por método" open>
      <p className="text-muted-foreground">Indicadores financeiros das vendas finalizadas nesta sessão. O líquido após estornos não é o saldo físico da gaveta. PIX e cartões ficam separados do dinheiro físico.</p>
      {data.paymentTotals.map(total => <section key={total.method} aria-label={methodLabel[total.method]} className="rounded-md border border-border/60 p-2"><h3 className="font-semibold">{methodLabel[total.method]}</h3><dl><Metric label="Originalmente aplicado" value={total.appliedCents} /><Metric label="Estornado posteriormente" value={total.refundedCents} /><Metric label="Líquido financeiro" value={total.netAppliedCents} /></dl></section>)}
    </HistorySection>
    <HistorySection label="Vendas da sessão" open><dl><Metric label="Total histórico finalizado" value={data.finalizedSalesTotalCents} /><Metric label="Total atualmente pago" value={data.currentlyPaidSalesTotalCents} /><Metric label="Total cancelado após finalização" value={data.canceledSalesTotalCents} /></dl><p className="text-muted-foreground">Comandas pendentes, descartadas e cancelamentos legados sem finalização não integram esses totais.</p></HistorySection>
    <HistorySection label={`Movimentos · página ${page}`} name="Movimentos históricos do caixa" open>
      {!data.movements.items.length && <p>Nenhum movimento registrado.</p>}{data.movements.items.map(m => <article key={m.id} className="space-y-1 rounded-md border border-border/60 p-2.5"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{movementLabels[m.kind] ?? "Movimento"}</p><strong className="tabular-nums">{money(m.amountCents)}</strong></div><p className="text-muted-foreground">{historyDate(m.createdAt, zone)} · {displayName(m.actor, "Operador")}</p><p>{displayName(m.reason, "Motivo registrado")}</p>{m.saleId && (onSale ? <Button size="sm" variant="outline" onClick={() => onSale(m.saleId!)}>Consultar venda vinculada</Button> : <p>Vinculado a uma venda.</p>)}{m.reversalOfId && <p>Reversão vinculada ao movimento original.</p>}</article>)}
      {showPagination && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={loading || page === 1} onClick={onPrevious}>Movimentos anteriores</Button><Button size="sm" variant="outline" disabled={loading || !data.movements.hasMore} onClick={onNext}>Próximos movimentos</Button></div>}
    </HistorySection>
  </div>
}
