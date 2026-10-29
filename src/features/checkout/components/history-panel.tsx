"use client"
import { useEffect, useState, useSyncExternalStore } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Choice, Field } from "./fields"
import { historyDate, historyStatus } from "./history-detail"
import { HistoryDetailSheet, HistoryError } from "./history-detail-sheet"
import { HistorySaleRow } from "./history-sale-row"
import { saleHistoryActions, type HistoryAction } from "../history-actions"
import { CheckoutHistoryController } from "../history-controller"
import type { Bootstrap } from "../types"
import type { HistoryKind } from "../history-types"
import { displayName } from "../display"
import { money } from "../helpers"

export function CheckoutHistoryPanel({ kind, data, provided, onOperate, onMutation, blockedSaleId }: { kind: HistoryKind; data: Bootstrap; provided?: CheckoutHistoryController; onOperate?: (id: string, edit: boolean) => Promise<boolean>; onMutation?: (id: string) => void; blockedSaleId?: string }) {
  const [controller] = useState(() => provided ?? new CheckoutHistoryController(kind))
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => { if (!provided) void controller.load() }, [controller, provided])
  const page = kind === "sales" ? state.sales : state.cash
  const zone = page?.period.timezone ?? "UTC"
  const customerOptions = new Map([...data.customers, ...(state.sales?.items.flatMap(row => row.customer ? [row.customer] : []) ?? [])].map(customer => [customer.id, customer.name]))
  const professionalOptions = new Map([...data.professionals, ...(state.sales?.items.flatMap(row => row.professionals) ?? [])].map(pro => [pro.id, pro.name]))
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [selectedProfessional, setSelectedProfessional] = useState<{ id: string; name: string } | null>(null)
  if (selectedCustomer) customerOptions.set(selectedCustomer.id, selectedCustomer.name)
  if (selectedProfessional) professionalOptions.set(selectedProfessional.id, selectedProfessional.name)
  const locked = state.actionBusy || state.actionRetry
  useEffect(() => {
    if (!locked) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [locked])
  const onAction = (id: string, action: HistoryAction) => {
    const sale = state.detailOpen && state.detailKind === "sales" && state.saleDetail?.id === id ? state.saleDetail : state.sales?.items.find(row => row.id === id)
    if (!sale || id === blockedSaleId || locked || action !== "details" && !saleHistoryActions(sale, data.operator.permissions).some(item => item.action === action)) return
    if (action === "continue" || action === "edit") { if (onOperate) void onOperate(id, action === "edit").then(opened => { if (opened) controller.closeDetail() }); return }
    if (action === "discard" || action === "cancel") { void controller.openAction(id, action); return }
    void controller.openDetail(id, action === "reversals")
  }
  return <section aria-label={kind === "sales" ? "Histórico de vendas" : "Histórico e conferência de caixas"} className="min-w-0 space-y-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{kind === "sales" ? "Histórico de vendas" : "Histórico e conferência de caixas"}</h2><p className="text-xs text-muted-foreground">{kind === "cash-sessions" ? "Somente consulta. Fechamentos e movimentos originais preservados." : "Histórico preservado. Operações disponíveis conforme o estado e a sua permissão."}</p></div><Button size="sm" variant="outline" disabled={state.loading} onClick={() => { void controller.load() }}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Atualizar histórico</Button></div>
    {kind === "sales" && <div role="group" aria-label="Contextos de vendas" className="flex flex-wrap items-center gap-2"><Button size="sm" variant={state.filters.view !== "open" ? "secondary" : "ghost"} aria-pressed={state.filters.view !== "open"} disabled={locked} onClick={() => { void controller.setView("history") }}>Histórico principal</Button><Button size="sm" variant={state.filters.view === "open" ? "secondary" : "ghost"} aria-pressed={state.filters.view === "open"} disabled={locked} onClick={() => { void controller.setView("open") }}>Comandas abertas</Button></div>}
    {blockedSaleId && <p className="text-xs text-muted-foreground">Salve ou cancele as alterações da comanda atual para operá-la pelo histórico.</p>}
    {state.notice && <p role="status" className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs">{state.notice}</p>}
    <details className="rounded-lg border border-border bg-card/30"><summary className="cursor-pointer rounded-lg px-3 py-2.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring">Filtros e busca</summary>
    <form aria-label="Filtros do histórico" className="grid min-w-0 gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={event => { event.preventDefault(); void controller.apply() }}>
      <Choice label="Período" value={state.filters.period} onChange={event => controller.setFilters({ period: event.target.value })}><option value="today">Hoje</option><option value="yesterday">Ontem</option><option value="week">Últimos 7 dias</option><option value="month">Este mês</option><option value="previousMonth">Mês anterior</option><option value="year">Este ano</option><option value="custom">Personalizado</option></Choice>
      {state.filters.period === "custom" && <><Field label="Data inicial" type="date" required value={state.filters.start} onChange={event => controller.setFilters({ start: event.target.value })} /><Field label="Data final" type="date" required value={state.filters.end} onChange={event => controller.setFilters({ end: event.target.value })} /></>}
      <Choice label="Data de referência" value={state.filters.dateField} onChange={event => controller.setFilters({ dateField: event.target.value })}>{(kind === "sales" ? [["createdAt", "Criação da venda"], ["finalizedAt", "Finalização"], ["voidedAt", "Descarte (inclui legado)"], ["canceledAt", "Cancelamento"]] : [["openedAt", "Abertura"], ["closedAt", "Fechamento"]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Choice>
      <Choice label="Estado" value={state.filters.status} onChange={event => controller.setFilters({ status: event.target.value })}><option value="">Todos</option>{(kind === "sales" ? state.filters.view === "open" ? ["PENDING"] : ["PAID", "CANCELED", ...(state.filters.includeVoided ? ["VOIDED"] : [])] : ["OPEN", "CLOSED"]).map(status => <option key={status} value={status}>{historyStatus[status]}</option>)}</Choice>
      <Field label="Buscar cliente por nome" type="search" minLength={2} maxLength={80} placeholder="Mínimo 2 caracteres" value={state.filters.customerQuery} onChange={event => controller.setFilters({ customerQuery: event.target.value })} />
      <Field label="Buscar profissional no histórico" type="search" minLength={2} maxLength={80} disabled={data.operator.role === "BARBER"} placeholder="Nome histórico · mínimo 2 caracteres" value={state.filters.professionalQuery} onChange={event => controller.setFilters({ professionalQuery: event.target.value })} />
      <Choice label="Cliente" value={state.filters.customerId} onChange={event => { const id = event.target.value; setSelectedCustomer(id ? { id, name: customerOptions.get(id) ?? "Cliente selecionado" } : null); controller.setFilters({ customerId: id }) }}><option value="">Todos os clientes</option>{[...customerOptions].map(([id, name]) => <option value={id} key={id}>{displayName(name, "Cliente")}</option>)}</Choice>
      <Choice label="Profissional" disabled={data.operator.role === "BARBER"} value={state.filters.professionalId} onChange={event => { const id = event.target.value; setSelectedProfessional(id ? { id, name: professionalOptions.get(id) ?? "Profissional selecionado" } : null); controller.setFilters({ professionalId: id }) }}><option value="">{data.operator.role === "BARBER" ? "Somente meus atendimentos" : "Todos os profissionais"}</option>{[...professionalOptions].map(([id, name]) => <option value={id} key={id}>{displayName(name, "Profissional")}</option>)}</Choice>
      {kind === "sales" && state.filters.view !== "open" && <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring" checked={!!state.filters.includeVoided} onChange={event => controller.setFilters({ includeVoided: event.target.checked, ...(!event.target.checked && state.filters.status === "VOIDED" ? { status: "" } : {}) })} />Incluir descartadas</label>}
      <div className="flex items-end"><Button type="submit" size="sm" disabled={state.loading}>Aplicar filtros</Button></div>
      <p className="text-[11px] text-muted-foreground sm:col-span-2 xl:col-span-4">A busca por nome inclui registros inativos vinculados às vendas. Clientes usam o nome cadastral atual; profissionais usam o nome histórico. Seletores e buscas são combinados. O período usa o timezone da barbearia.</p>
    </form></details>
    {state.error && <HistoryError message={state.error} status={state.status} retry={() => { void controller.load() }} />}
    <div aria-busy={state.loading} aria-live="polite" className="min-w-0 space-y-2">
      {state.loading ? <p role="status" className="rounded-lg border bg-muted p-5 text-sm">Carregando histórico…</p> : !state.error && <>
        {page && <p className="text-xs text-muted-foreground">{page.period.start} — {page.period.end} · {zone} · Página {state.page} · {page.items.length} registros nesta página</p>}
        {!page?.items.length && <p role="status" className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nenhum registro encontrado para os filtros selecionados.</p>}
        {kind === "sales" ? state.sales?.items.map(sale => <HistorySaleRow key={sale.id} sale={sale} zone={zone} permissions={data.operator.permissions} disabled={locked || blockedSaleId === sale.id} onAction={action => onAction(sale.id, action)} />) : state.cash?.items.map(session => <button type="button" key={session.id} className="grid w-full min-w-0 gap-2 rounded-xl border bg-card p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto]" onClick={() => { void controller.openDetail(session.id) }}><div className="min-w-0"><p className="break-words text-sm font-medium">{displayName(session.cashRegisterName, "Caixa")} · {historyStatus[session.status]}</p><p className="text-xs text-muted-foreground">Abertura: {historyDate(session.openedAt, zone)}</p><p className="text-xs text-muted-foreground">Fechamento: {historyDate(session.closedAt, zone)}</p></div><div className="text-xs"><p>Saldo inicial: {money(session.openingBalanceCents)}</p><p>Diferença original: {session.differenceCents === null ? "—" : money(session.differenceCents)}</p><span className="text-muted-foreground">Consultar conferência</span></div></button>)}
      </>}
    </div>
    <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" disabled={state.loading || state.page === 1} onClick={() => { void controller.previous() }}>Página anterior</Button><span className="text-xs">Página {state.page}</span><Button size="sm" variant="outline" disabled={state.loading || !page?.hasMore || !!state.error} onClick={() => { void controller.next() }}>Próxima página</Button></div>
    <HistoryDetailSheet state={state} controller={controller} data={data} onAction={onAction} onMutation={onMutation} blockedSaleId={blockedSaleId} />
  </section>
}
