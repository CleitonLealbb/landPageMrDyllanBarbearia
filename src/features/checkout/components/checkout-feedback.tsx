"use client"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CheckoutController, CheckoutState } from "../controller"

export function CheckoutFeedback({ state, controller }: { state: CheckoutState; controller: CheckoutController }) {
  return <>
    {state.error && <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
      <p>{state.error}</p>
      {state.status === 401 && <a className="underline" href="/login">Entrar novamente</a>}
      {state.status === 409 && state.sale && !state.retry && <><p>Para abandonar as alterações locais e recuperar a versão atual do servidor:</p><Button size="sm" variant="outline" disabled={state.busy} onClick={() => { void controller.reloadConflict() }}>Carregar versão atual</Button></>}
      {state.retry && <>
        <p>A operação pode ter sido concluída. Os dados estão bloqueados até confirmar a mesma requisição com a mesma chave.</p>
        <Button size="sm" variant="outline" disabled={state.busy} onClick={() => { void controller.retry() }}>Repetir operação com segurança</Button>
      </>}
      {!state.data && !state.retry && <Button size="sm" variant="outline" disabled={state.loading} onClick={() => { void controller.load() }}>Tentar carregar novamente</Button>}
    </div>}
    {state.notice && <p role="status" className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />{state.notice}</p>}
  </>
}
