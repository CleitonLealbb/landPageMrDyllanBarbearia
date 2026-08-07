"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { Clock3, Edit3, Plus, RefreshCw, Scissors, Search, UserRoundCog, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { calculateServiceSummary, centsToReais, formatBRL, normalizeServicePayload, safeApiMessage } from "../helpers"
import type { CatalogService, ProfessionalOption, ServiceFormValues } from "../types"
import { ProfessionalsDialog } from "./professionals-dialog"
import { ServiceFormDialog } from "./service-form-dialog"
import { ServiceStatusDialog } from "./service-status-dialog"

const emptyForm: ServiceFormValues = { name: "", description: "", priceReais: "", durationMinutes: "30", displayOrder: "0", status: "ACTIVE" }

function isCatalogServiceArray(value: unknown): value is CatalogService[] { return Array.isArray(value) }
function isProfessionalArray(value: unknown): value is ProfessionalOption[] { return Array.isArray(value) }

export function ServicesView() {
  const [services, setServices] = useState<CatalogService[]>([])
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogService | null>(null)
  const [form, setForm] = useState<ServiceFormValues>(emptyForm)
  const [professionalsService, setProfessionalsService] = useState<CatalogService | null>(null)
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([])
  const [statusService, setStatusService] = useState<CatalogService | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadCatalog = useCallback(async () => {
    setLoading(true); setLoadError(false)
    try {
      const [servicesResponse, professionalsResponse] = await Promise.all([fetch("/api/services", { cache: "no-store" }), fetch("/api/professionals", { cache: "no-store" })])
      if (!servicesResponse.ok || !professionalsResponse.ok) throw new Error("request failed")
      const [servicesData, professionalsData]: unknown[] = await Promise.all([servicesResponse.json(), professionalsResponse.json()])
      if (!isCatalogServiceArray(servicesData) || !isProfessionalArray(professionalsData)) throw new Error("invalid response")
      setServices(servicesData); setProfessionals(professionalsData.filter((professional) => professional.status !== "INACTIVE"))
    } catch { setLoadError(true) } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadCatalog() }, [loadCatalog])

  const summary = useMemo(() => calculateServiceSummary(services), [services])
  const filtered = useMemo(() => { const term = query.trim().toLocaleLowerCase("pt-BR"); return term ? services.filter((service) => `${service.name} ${service.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(term)) : services }, [query, services])

  function openNew() { setEditing(null); setForm(emptyForm); setFormOpen(true) }
  function openEdit(service: CatalogService) { setEditing(service); setForm({ name: service.name, description: service.description ?? "", priceReais: centsToReais(service.priceCents), durationMinutes: String(service.durationMinutes), displayOrder: String(service.displayOrder), status: service.status }); setFormOpen(true) }
  function openProfessionals(service: CatalogService) { setProfessionalsService(service); setSelectedProfessionals(service.professionals.map(({ professional }) => professional.id)) }

  async function submitForm(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizeServicePayload(form)
    if (normalized.error) { toast.error(normalized.error); return }
    setSubmitting(true)
    try {
      const response = await fetch(editing ? `/api/services/${editing.id}` : "/api/services", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(normalized.payload) })
      if (!response.ok) { toast.error(safeApiMessage(response.status)); return }
      await loadCatalog(); setFormOpen(false); toast.success(editing ? "Serviço atualizado." : "Serviço criado.")
    } catch { toast.error("Não foi possível conectar ao servidor. Tente novamente.") } finally { setSubmitting(false) }
  }

  async function saveProfessionals() {
    if (!professionalsService) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/services/${professionalsService.id}/professionals`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ professionalIds: selectedProfessionals }) })
      if (!response.ok) { toast.error(safeApiMessage(response.status)); return }
      await loadCatalog(); setProfessionalsService(null); toast.success("Profissionais associados com sucesso.")
    } catch { toast.error("Não foi possível conectar ao servidor. As associações anteriores foram preservadas.") } finally { setSubmitting(false) }
  }

  async function changeStatus(service: CatalogService) {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/services/${service.id}`, { method: service.status === "ACTIVE" ? "DELETE" : "PUT", headers: { "Content-Type": "application/json" }, ...(service.status === "INACTIVE" ? { body: JSON.stringify({ status: "ACTIVE" }) } : {}) })
      if (!response.ok) { toast.error(safeApiMessage(response.status)); return }
      await loadCatalog(); setStatusService(null); toast.success(service.status === "ACTIVE" ? "Serviço inativado." : "Serviço reativado.")
    } catch { toast.error("Não foi possível conectar ao servidor. Tente novamente.") } finally { setSubmitting(false) }
  }

  if (loading) return <div className="space-y-6 p-4 sm:p-6"><Skeleton className="h-12 w-64" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}</div><Skeleton className="h-80" /></div>

  return <div className="min-h-screen p-4 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><SidebarTrigger className="mt-1 shrink-0" /><div><h1 className="text-2xl font-bold sm:text-3xl">Serviços</h1><p className="mt-1 text-sm text-muted-foreground">Gerencie o catálogo que será exibido aos seus clientes.</p></div></div><Button onClick={openNew}><Plus className="mr-2 size-4" />Novo serviço</Button></header>
      {loadError ? <Card><CardContent className="flex flex-col items-center gap-4 py-12 text-center"><p className="text-muted-foreground">Não foi possível carregar o catálogo.</p><Button variant="outline" onClick={() => void loadCatalog()}><RefreshCw className="mr-2 size-4" />Tentar novamente</Button></CardContent></Card> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{([
          ["Total", summary.total, Scissors],
          ["Ativos", summary.active, Scissors],
          ["Inativos", summary.inactive, Scissors],
          ["Duração média", `${summary.averageDuration} min`, Clock3],
        ] satisfies Array<[string, string | number, LucideIcon]>).map(([label, value, Icon]) => <Card key={label}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle><Icon className="size-4 text-primary" /></CardHeader><CardContent><strong className="text-2xl">{value}</strong></CardContent></Card>)}</div>
        <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar serviço..." value={query} onChange={(e) => setQuery(e.currentTarget.value)} /></div>
        {services.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><Scissors className="size-10 text-primary" /><h2 className="text-lg font-semibold">Seu catálogo está vazio</h2><p className="max-w-md text-sm text-muted-foreground">Cadastre o primeiro serviço para começar a montar o catálogo dos clientes.</p><Button onClick={openNew}><Plus className="mr-2 size-4" />Novo serviço</Button></CardContent></Card> : filtered.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum serviço corresponde à busca.</CardContent></Card> : <ServiceList services={filtered} onEdit={openEdit} onProfessionals={openProfessionals} onStatus={(service) => service.status === "ACTIVE" ? setStatusService(service) : void changeStatus(service)} submitting={submitting} />}
      </>}
    </div>
    <ServiceFormDialog open={formOpen} service={editing} values={form} submitting={submitting} onOpenChange={setFormOpen} onChange={setForm} onSubmit={submitForm} />
    <ProfessionalsDialog service={professionalsService} professionals={professionals} selected={selectedProfessionals} submitting={submitting} onOpenChange={(open) => !open && setProfessionalsService(null)} onSelectedChange={setSelectedProfessionals} onSave={saveProfessionals} />
    <ServiceStatusDialog service={statusService} submitting={submitting} onOpenChange={(open) => !open && setStatusService(null)} onConfirm={() => statusService && void changeStatus(statusService)} />
  </div>
}

type ListProps = { services: CatalogService[]; submitting: boolean; onEdit: (service: CatalogService) => void; onProfessionals: (service: CatalogService) => void; onStatus: (service: CatalogService) => void }
function ServiceActions({ service, submitting, onEdit, onProfessionals, onStatus }: ListProps & { service: CatalogService }) { return <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(service)}><Edit3 className="mr-1 size-4" />Editar</Button><Button size="sm" variant="outline" onClick={() => onProfessionals(service)}><UserRoundCog className="mr-1 size-4" />Profissionais</Button><Button size="sm" variant={service.status === "ACTIVE" ? "destructive" : "default"} disabled={submitting} onClick={() => onStatus(service)}>{service.status === "ACTIVE" ? "Inativar" : "Reativar"}</Button></div> }
function ServiceList(props: ListProps) { return <><div className="hidden overflow-hidden rounded-lg border lg:block"><Table><TableHeader><TableRow><TableHead>Serviço</TableHead><TableHead>Preço</TableHead><TableHead>Duração</TableHead><TableHead>Ordem</TableHead><TableHead>Status</TableHead><TableHead>Profissionais</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{props.services.map((service) => <TableRow key={service.id}><TableCell className="max-w-xs"><strong className="block">{service.name}</strong><span className="block truncate text-xs text-muted-foreground">{service.description || "Sem descrição"}</span></TableCell><TableCell>{formatBRL(service.priceCents)}</TableCell><TableCell>{service.durationMinutes} min</TableCell><TableCell>{service.displayOrder}</TableCell><TableCell><Badge variant={service.status === "ACTIVE" ? "default" : "secondary"}>{service.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge></TableCell><TableCell>{service.professionals.length}</TableCell><TableCell><ServiceActions {...props} service={service} /></TableCell></TableRow>)}</TableBody></Table></div><div className="grid gap-4 lg:hidden">{props.services.map((service) => <Card key={service.id}><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{service.name}</h3><p className="line-clamp-2 text-sm text-muted-foreground">{service.description || "Sem descrição"}</p></div><Badge variant={service.status === "ACTIVE" ? "default" : "secondary"}>{service.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><span><small className="block text-muted-foreground">Preço</small>{formatBRL(service.priceCents)}</span><span><small className="block text-muted-foreground">Duração</small>{service.durationMinutes} min</span><span><small className="block text-muted-foreground">Ordem</small>{service.displayOrder}</span><span><small className="block text-muted-foreground">Profissionais</small>{service.professionals.length}</span></div><ServiceActions {...props} service={service} /></CardContent></Card>)}</div></> }
