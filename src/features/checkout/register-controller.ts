import { CheckoutHttp, CheckoutRequestError } from "./http"

export type RegisterSummary = { id: string; name: string; active: boolean }
export type Register = RegisterSummary & { hasOpenSession: boolean; openSession: { id: string; status: "OPEN" } | null }
export type RegisterState = { registers: Register[]; loading: boolean; busy: boolean; error: string | null; notice: string | null; retry: boolean }
export function registerStatus(row: Register) { return row.hasOpenSession ? "Aberto" : row.active ? "Fechado" : "Inativo" }

export class RegisterController {
  private state: RegisterState = { registers: [], loading: true, busy: false, error: null, notice: null, retry: false }
  private listeners = new Set<() => void>()
  private pending: { id?: string; input: { name?: string; active?: boolean } } | null = null
  constructor(private http = new CheckoutHttp()) {}
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private patch(value: Partial<RegisterState>) { this.state = { ...this.state, ...value }; this.listeners.forEach(listener => listener()) }
  async load() {
    this.patch({ loading: true, error: null })
    try { this.patch({ registers: (await this.http.get<{ registers: Register[] }>("cash-registers")).registers }) }
    catch (error) { this.patch({ error: error instanceof CheckoutRequestError ? error.message : "Não foi possível carregar os caixas." }) }
    finally { this.patch({ loading: false }) }
  }
  async save(input: { name?: string; active?: boolean }, id?: string): Promise<RegisterSummary | null> {
    if (this.state.busy || (this.pending && !this.state.retry)) return null
    // After an uncertain response only the original intent may be retried.
    const intent = this.pending ?? { id, input }
    this.pending = intent
    this.patch({ busy: true, error: null, notice: null })
    let result: RegisterSummary | null = null
    try {
      const path = intent.id ? `cash-registers/${encodeURIComponent(intent.id)}` : "cash-registers"
      result = intent.id ? await this.http.patch<RegisterSummary>(path, intent.input) : await this.http.post<RegisterSummary>(path, intent.input)
      this.pending = null
      this.http.newIntent()
      await this.load()
      this.patch({ notice: "Caixa salvo. O histórico foi preservado.", retry: false })
    } catch (error) {
      const uncertain = !(error instanceof CheckoutRequestError) || error.status >= 500
      if (!uncertain) { this.pending = null; this.http.newIntent() }
      this.patch({ retry: uncertain, error: error instanceof CheckoutRequestError && error.status === 409 ? "Não foi possível salvar: feche a sessão aberta antes de inativar, confira nomes repetidos e atualize os caixas." : error instanceof CheckoutRequestError ? error.message : "Não foi possível confirmar. Repita a mesma operação com segurança." })
    } finally { this.patch({ busy: false }) }
    return result
  }
}
