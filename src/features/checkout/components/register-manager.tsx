"use client"
import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field } from "./fields"
import { displayName } from "../display"
import { RegisterController, registerStatus } from "../register-controller"

export function RegisterManager({ onSaved, controller: supplied }: { onSaved?: (id: string) => Promise<void>; controller?: RegisterController }) {
  const [controller] = useState(() => supplied ?? new RegisterController())
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [name, setName] = useState("")
  const [editing, setEditing] = useState<string | undefined>()
  useEffect(() => { void controller.load() }, [controller])
  const locked = state.busy || state.retry
  const save = async (input: { name?: string; active?: boolean }, id?: string) => {
    const row = await controller.save(input, id)
    if (row) {
      setName(""); setEditing(undefined)
      if (row.active) await onSaved?.(row.id)
    }
  }
  return <section aria-label="Gerenciamento de caixas" className="min-w-0 space-y-5">
    <p className="text-sm text-muted-foreground">Cadastre os caixas físicos da barbearia. Inativar não encerra sessões nem apaga o histórico. Nomes repetidos são recusados.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void save({ name }, editing) }}>
      <div className="min-w-0 flex-1"><Field label={editing ? "Novo nome do caixa" : "Nome do novo caixa"} value={name} onChange={event => setName(event.target.value)} required maxLength={80} disabled={locked} /></div>
      <Button type="submit" disabled={locked || !name.trim()}>{state.busy ? "Salvando…" : editing ? "Salvar nome" : "Cadastrar caixa"}</Button>
      {editing && <Button type="button" variant="outline" disabled={locked} onClick={() => { setEditing(undefined); setName("") }}>Cancelar renomeação</Button>}
    </form>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.notice && <p role="status" className="text-sm text-primary">{state.notice}</p>}
    {state.retry ? <Button disabled={state.busy} variant="outline" onClick={() => void save({})}>Repetir operação com segurança</Button> : <Button variant="outline" disabled={state.busy || state.loading} onClick={() => void controller.load()}>Atualizar caixas</Button>}
    {state.loading ? <p role="status">Carregando caixas…</p> : state.registers.length ? <ul className="space-y-3">{state.registers.map((row, index) => <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0 flex-1"><p className="break-words font-medium">{displayName(row.name === row.id ? "" : row.name, `Caixa ${index + 1}`)}</p><Badge variant="secondary">{registerStatus(row)}</Badge>{row.hasOpenSession && <p className="mt-2 text-xs text-muted-foreground">Feche a sessão aberta antes de inativar este caixa.</p>}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={locked} onClick={() => { setEditing(row.id); setName(displayName(row.name === row.id ? "" : row.name, `Caixa ${index + 1}`)) }}>Renomear</Button><Button variant="secondary" disabled={locked || (row.active && row.hasOpenSession)} onClick={() => void save({ active: !row.active }, row.id)}>{row.active ? "Inativar" : "Ativar"}</Button></div>
    </li>)}</ul> : <p role="status" className="rounded-lg border border-dashed p-5 text-muted-foreground">Nenhum caixa cadastrado. Cadastre o primeiro caixa para iniciar a operação.</p>}
    <Button asChild variant="link"><Link href="/dashboard?view=checkout">Voltar ao Checkout</Link></Button>
  </section>
}
