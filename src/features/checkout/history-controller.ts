import { CheckoutHttp, CheckoutRequestError } from "./http"
import type { CashHistoryDetail, CashHistoryRow, HistoryKind, HistoryPage, SaleHistoryDetail, SaleHistoryRow } from "./history-types"
import { cancelSchema, voidSchema } from "@/lib/checkout/validation"
import type { Sale } from "./types"

export type HistoryFilters = { period: string; start: string; end: string; status: string; customerId: string; professionalId: string; customerQuery: string; professionalQuery: string; dateField: string; view?: "history" | "open"; includeVoided?: boolean }
export type HistoryState = {
  filters: HistoryFilters; loading: boolean; error: string | null; status: number | null; page: number;
  sales: HistoryPage<SaleHistoryRow> | null; cash: HistoryPage<CashHistoryRow> | null;
  detailOpen: boolean; detailKind: HistoryKind; detailLoading: boolean; detailError: string | null; detailStatus: number | null;
  saleDetail: SaleHistoryDetail | null; cashDetail: CashHistoryDetail | null; movementPage: number
  focusReversals: boolean; action: "cancel" | "discard" | null; actionBusy: boolean; actionRetry: boolean; actionError: string | null; notice: string | null
}
export function historyParams(filters: HistoryFilters, cursor: string | null) {
  const params = new URLSearchParams({ period: filters.period, pageSize: "20", dateField: filters.dateField })
  for (const key of ["status", "customerId", "professionalId", "customerQuery", "professionalQuery"] as const) if (filters[key].trim()) params.set(key, filters[key].trim())
  if (filters.period === "custom") { params.set("start", filters.start); params.set("end", filters.end) }
  if (cursor) params.set("cursor", cursor)
  if (filters.view) { params.set("view", filters.view); if (filters.includeVoided) params.set("includeVoided", "true") }
  return params.toString()
}
function failure(error: unknown) {
  return { message: error instanceof CheckoutRequestError ? error.message : "Não foi possível carregar o histórico. Tente novamente.", status: error instanceof CheckoutRequestError ? error.status : null }
}
export class CheckoutHistoryController {
  private listeners = new Set<() => void>()
  private generation = 0
  private detailGeneration = 0
  private cursor: string | null = null
  private previousCursors: (string | null)[] = []
  private detailCursor: string | null = null
  private previousDetailCursors: (string | null)[] = []
  private detailId = ""
  private applied: HistoryFilters
  private state: HistoryState
  private pendingAction: { path: string; input: unknown } | null = null
  constructor(readonly kind: HistoryKind, private http = new CheckoutHttp()) {
    this.applied = { period: "month", start: "", end: "", status: "", customerId: "", professionalId: "", customerQuery: "", professionalQuery: "", dateField: kind === "sales" ? "createdAt" : "openedAt", ...(kind === "sales" ? { view: "history" as const, includeVoided: false } : {}) }
    this.state = { filters: this.applied, loading: true, error: null, status: null, page: 1, sales: null, cash: null, detailOpen: false, detailKind: kind, detailLoading: false, detailError: null, detailStatus: null, saleDetail: null, cashDetail: null, movementPage: 1, focusReversals: false, action: null, actionBusy: false, actionRetry: false, actionError: null, notice: null }
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.state
  private patch(change: Partial<HistoryState>) { this.state = { ...this.state, ...change }; this.listeners.forEach(listener => listener()) }
  setFilters(change: Partial<HistoryFilters>) { this.patch({ filters: { ...this.state.filters, ...change } }) }
  async setView(view: "history" | "open") {
    if (this.state.actionBusy || this.state.actionRetry) return
    this.setFilters({ view, status: "", includeVoided: false, dateField: "createdAt" }); await this.apply()
  }
  async apply() { this.applied = { ...this.state.filters }; this.cursor = null; this.previousCursors = []; this.patch({ page: 1 }); this.closeDetail(); await this.load() }
  async load() {
    const generation = ++this.generation
    this.patch({ loading: true, error: null, status: null })
    try {
      const path = `${this.kind}?${historyParams(this.applied, this.cursor)}`
      if (this.kind === "sales") { const sales = await this.http.get<HistoryPage<SaleHistoryRow>>(path); if (generation === this.generation) this.patch({ sales }) }
      else { const cash = await this.http.get<HistoryPage<CashHistoryRow>>(path); if (generation === this.generation) this.patch({ cash }) }
    } catch (error) { if (generation === this.generation) { const result = failure(error); this.patch({ error: result.message, status: result.status }) } }
    finally { if (generation === this.generation) this.patch({ loading: false }) }
  }
  async next() {
    const next = (this.kind === "sales" ? this.state.sales : this.state.cash)?.nextCursor
    if (this.state.loading || !next) return
    this.previousCursors.push(this.cursor); this.cursor = next; this.patch({ page: this.state.page + 1 }); await this.load()
  }
  async previous() { if (this.state.loading || !this.previousCursors.length) return; this.cursor = this.previousCursors.pop()!; this.patch({ page: this.state.page - 1 }); await this.load() }
  async openDetail(id: string, focusReversals = false) {
    if (this.state.actionBusy || this.state.actionRetry) return
    this.detailId = id; this.detailCursor = null; this.previousDetailCursors = []
    this.patch({ detailOpen: true, detailKind: this.kind, saleDetail: null, cashDetail: null, movementPage: 1, focusReversals, action: null, actionError: null })
    await this.loadDetail()
  }
  closeDetail() { if (this.state.actionBusy || this.state.actionRetry) return; this.detailGeneration++; this.patch({ detailOpen: false, detailLoading: false, action: null }) }
  async openLinkedSale(id: string) { this.detailId = id; this.patch({ detailKind: "sales", saleDetail: null }); await this.loadDetail() }
  async backToCash() { const id = this.state.cashDetail?.session.id; if (id) await this.openDetail(id) }
  async loadDetail() {
    const generation = ++this.detailGeneration, id = encodeURIComponent(this.detailId)
    this.patch({ detailLoading: true, detailError: null, detailStatus: null })
    try {
      if (this.state.detailKind === "sales") { const saleDetail = await this.http.get<SaleHistoryDetail>(`sales/${id}?include=history`); if (generation === this.detailGeneration) this.patch({ saleDetail }) }
      else { const cashDetail = await this.http.get<CashHistoryDetail>(`cash-sessions/${id}?pageSize=20${this.detailCursor ? `&cursor=${encodeURIComponent(this.detailCursor)}` : ""}`); if (generation === this.detailGeneration) this.patch({ cashDetail }) }
    } catch (error) { if (generation === this.detailGeneration) { const result = failure(error); this.patch({ detailError: result.message, detailStatus: result.status }) } }
    finally { if (generation === this.detailGeneration) this.patch({ detailLoading: false }) }
  }
  async nextMovements() { const cursor = this.state.cashDetail?.movements.nextCursor; if (!cursor || this.state.detailLoading) return; this.previousDetailCursors.push(this.detailCursor); this.detailCursor = cursor; this.patch({ movementPage: this.state.movementPage + 1 }); await this.loadDetail() }
  async previousMovements() { if (this.state.detailLoading || !this.previousDetailCursors.length) return; this.detailCursor = this.previousDetailCursors.pop()!; this.patch({ movementPage: this.state.movementPage - 1 }); await this.loadDetail() }
  async openAction(id: string, action: "discard" | "cancel") {
    if (this.state.actionBusy || this.state.actionRetry) return
    await this.openDetail(id)
    const sale = this.state.saleDetail
    if (!this.state.detailOpen || !sale || sale.id !== id) return
    if ((action === "discard" && sale.status !== "PENDING") || (action === "cancel" && (sale.status !== "PAID" || !sale.finalizedAt))) {
      this.patch({ actionError: "O estado da venda mudou. Confira os detalhes atuais." }); return
    }
    this.patch({ action, actionError: null })
  }
  closeAction() { if (!this.state.actionBusy && !this.state.actionRetry) this.patch({ action: null, actionError: null }) }
  async confirmAction(reason: string, cashSessionId?: string) {
    if (this.state.actionBusy || this.state.actionRetry || !this.state.action || !this.state.saleDetail) return null
    try {
      const sale = this.state.saleDetail, action = this.state.action
      const input = action === "discard" ? voidSchema.parse({ reason, expectedVersion: sale.version }) : cancelSchema.parse({ reason, ...(cashSessionId ? { cashSessionId } : {}) })
      this.pendingAction = { path: `sales/${encodeURIComponent(sale.id)}/${action === "discard" ? "void" : "cancel"}`, input }
      return await this.sendAction()
    } catch { this.patch({ actionError: "Confira o motivo e o caixa selecionado." }); return null }
  }
  async retryAction() { return !this.state.actionBusy && this.state.actionRetry ? this.sendAction() : null }
  private async sendAction() {
    const request = this.pendingAction
    if (!request) return null
    this.patch({ actionBusy: true, actionError: null })
    let result: Sale | null = null
    try {
      result = await this.http.post<Sale>(request.path, request.input)
      this.pendingAction = null
      this.patch({ action: null, actionRetry: false, notice: result.status === "VOIDED" ? "Comanda descartada. Nenhuma movimentação financeira foi realizada." : "Venda cancelada. Os lançamentos aplicáveis foram revertidos." })
    } catch (error) {
      const uncertain = !(error instanceof CheckoutRequestError) || error.status >= 500
      if (!uncertain) this.pendingAction = null
      this.patch({ actionRetry: uncertain, actionError: failure(error).message })
    } finally { this.patch({ actionBusy: false }) }
    // Read failures after an acknowledged mutation never repeat financial work.
    if (result) await Promise.all([this.load(), this.loadDetail()])
    return result
  }
}
