"use client"

import { useMemo, useState, type FormEvent } from "react"
import { Pencil, Plus, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import {
  centsToReais,
  filterPackages,
  formatBRL,
  normalizePackagePayload,
  safeApiMessage,
} from "../helpers"
import type {
  CatalogService,
  ServicePackage,
  ServicePackageFormValues,
} from "../types"

type Props = {
  packages: ServicePackage[]
  services: CatalogService[]
  reload: () => Promise<void>
}

const emptyForm: ServicePackageFormValues = {
  name: "",
  description: "",
  priceReais: "",
  durationMinutes: "60",
  displayOrder: "0",
  status: "ACTIVE",
  serviceIds: [],
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export function PackagesPanel({ packages, services, reload }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ServicePackage | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [form, setForm] = useState<ServicePackageFormValues>(emptyForm)

  const filtered = useMemo(
    () => filterPackages(packages, query),
    [packages, query]
  )
  const selectableServices = services.filter(
    (service) => service.status === "ACTIVE" || form.serviceIds.includes(service.id)
  )

  function begin(item?: ServicePackage) {
    setEditing(item ?? null)
    setForm(item ? {
      name: item.name,
      description: item.description ?? "",
      priceReais: centsToReais(item.priceCents),
      durationMinutes: String(item.durationMinutes),
      displayOrder: String(item.displayOrder),
      status: item.status,
      serviceIds: item.services.map((service) => service.id),
    } : emptyForm)
    setOpen(true)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizePackagePayload(form)
    if ("error" in normalized) return void toast.error(normalized.error)

    const payload = normalized.payload
    const originalIds = editing?.services.map((service) => service.id) ?? []
    const body: Partial<typeof payload> = { ...payload }
    if (editing && sameIds(originalIds, payload.serviceIds)) delete body.serviceIds
    if (editing && editing.status === payload.status) delete body.status

    setBusy("form")
    try {
      const response = await fetch(
        editing ? `/api/service-packages/${editing.id}` : "/api/service-packages",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      if (!response.ok) return void toast.error(safeApiMessage(response.status))
      await reload()
      setOpen(false)
      toast.success(editing ? "Combo atualizado." : "Combo criado.")
    } catch {
      toast.error("Nao foi possivel conectar ao servidor.")
    } finally {
      setBusy(null)
    }
  }

  async function toggle(item: ServicePackage) {
    if (busy) return
    setBusy(item.id)
    try {
      const response = await fetch(`/api/service-packages/${item.id}`, {
        method: item.status === "ACTIVE" ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        ...(item.status === "INACTIVE"
          ? { body: JSON.stringify({ status: "ACTIVE" }) }
          : {}),
      })
      if (!response.ok) return void toast.error(safeApiMessage(response.status))
      await reload()
      toast.success(item.status === "ACTIVE" ? "Combo inativado." : "Combo reativado.")
    } catch {
      toast.error("Nao foi possivel conectar ao servidor.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Combos e pacotes</h3>
          <p className="text-sm text-muted-foreground">Agrupe servicos com preco e duracao proprios.</p>
        </div>
        <Button onClick={() => begin()}><Plus aria-hidden="true" />Novo Combo</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input className="pl-9" aria-label="Buscar combo" placeholder="Buscar combo..." value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      </div>

      {packages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">Nenhum combo cadastrado.</div>
      ) : filtered.length === 0 ? (
        <div role="status" className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">Nenhum combo corresponde a busca.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold">{item.name}</h4>
                    <span className="text-xs">{item.status === "ACTIVE" ? "Ativo" : "Inativo"}</span>
                    <Switch checked={item.status === "ACTIVE"} disabled={busy === item.id} aria-busy={busy === item.id} aria-label={`${item.status === "ACTIVE" ? "Inativar" : "Reativar"} combo ${item.name}`} onCheckedChange={() => void toggle(item)} />
                  </div>
                  {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground line-through">{formatBRL(item.originalPriceCents)}</span>
                  <strong className="ml-2 text-lg text-primary">{formatBRL(item.priceCents)}</strong>
                  <p className="text-xs text-muted-foreground">Economia {formatBRL(item.originalPriceCents - item.priceCents)} · {item.durationMinutes} min</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.services.map((service) => <span key={service.id} className="rounded bg-muted px-2 py-1 text-xs">{service.name}</span>)}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Ordem {item.displayOrder}</span>
                <Button variant="ghost" size="sm" onClick={() => begin(item)}><Pencil aria-hidden="true" />Editar</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar combo" : "Novo combo"}</DialogTitle>
              <DialogDescription>Selecione ao menos dois servicos da barbearia.</DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-4">
              <div className="space-y-2"><Label htmlFor="combo-name">Nome</Label><Input id="combo-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.currentTarget.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="combo-description">Descricao</Label><Input id="combo-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.currentTarget.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="combo-price">Preco do combo</Label><Input id="combo-price" inputMode="decimal" value={form.priceReais} onChange={(event) => setForm({ ...form, priceReais: event.currentTarget.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="combo-duration">Duracao (minutos)</Label><Input id="combo-duration" type="number" min={1} step={1} value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.currentTarget.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="combo-order">Ordem</Label><Input id="combo-order" type="number" min={0} step={1} value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.currentTarget.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="combo-status">Status</Label><Select value={form.status} onValueChange={(status: "ACTIVE" | "INACTIVE") => setForm({ ...form, status })}><SelectTrigger id="combo-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Ativo</SelectItem><SelectItem value="INACTIVE">Inativo</SelectItem></SelectContent></Select></div>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Servicos</legend>
                <div className="max-h-48 space-y-2 overflow-auto rounded border p-3">
                  {selectableServices.map((service) => (
                    <label key={service.id} className="flex gap-2 text-sm">
                      <input type="checkbox" checked={form.serviceIds.includes(service.id)} onChange={() => setForm({ ...form, serviceIds: form.serviceIds.includes(service.id) ? form.serviceIds.filter((id) => id !== service.id) : [...form.serviceIds, service.id] })} />
                      <span>{service.name}{service.status === "INACTIVE" ? " (Inativo)" : ""}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={busy === "form"}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
