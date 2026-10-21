"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { centsToReais, normalizeServicePayload, safeApiMessage } from "../helpers"
import type { CatalogService, ProfessionalOption, ServiceCategory, ServiceFormValues, ServicePackage } from "../types"
import { ProfessionalsDialog } from "./professionals-dialog"
import { ServiceCatalogPanel } from "./service-catalog-panel"
import { ServiceFormDialog } from "./service-form-dialog"
import { ServicesSettingsHeader } from "./services-settings-header"
import { TeamPanel } from "./team-panel"
import { ServicesLoading } from "./services-loading"

const emptyForm: ServiceFormValues = { name: "", description: "", priceReais: "", durationMinutes: "30", displayOrder: "0", status: "ACTIVE", categoryId: "" }
const isArray = <T,>(value: unknown): value is T[] => Array.isArray(value)

export function ServicesView() {
  const [services, setServices] = useState<CatalogService[]>([])
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showLoading, setShowLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogService | null>(null)
  const [form, setForm] = useState<ServiceFormValues>(emptyForm)
  const [professionalsService, setProfessionalsService] = useState<CatalogService | null>(null)
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const loadCatalog = useCallback(async () => {
    setLoading(true); setLoadError(false)
    try {
      const [serviceResponse, professionalResponse, categoryResponse, packageResponse] = await Promise.all([fetch("/api/services", { cache: "no-store" }), fetch("/api/professionals", { cache: "no-store" }), fetch("/api/service-categories", { cache: "no-store" }), fetch("/api/service-packages", { cache: "no-store" })])
      if (!serviceResponse.ok || !professionalResponse.ok || !categoryResponse.ok || !packageResponse.ok) throw new Error("request failed")
      const [serviceData, professionalData, categoryData, packageData]: unknown[] = await Promise.all([serviceResponse.json(), professionalResponse.json(), categoryResponse.json(), packageResponse.json()])
      if (!isArray<CatalogService>(serviceData) || !isArray<ProfessionalOption>(professionalData) || !isArray<ServiceCategory>(categoryData) || !isArray<ServicePackage>(packageData)) throw new Error("invalid response")
      setServices(serviceData); setProfessionals(professionalData.filter((professional) => professional.status !== "INACTIVE")); setCategories(categoryData); setPackages(packageData)
    } catch { setLoadError(true) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void loadCatalog() }, [loadCatalog])
  useEffect(() => { if (!loading) { setShowLoading(false); return }; const timer = window.setTimeout(() => setShowLoading(true), 180); return () => window.clearTimeout(timer) }, [loading])

  const filtered = useMemo(() => { const term = query.trim().toLocaleLowerCase("pt-BR"); return term ? services.filter((service) => `${service.name} ${service.description ?? ""} ${service.category?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(term)) : services }, [query, services])
  function openNew() { setEditing(null); setForm(emptyForm); setFormOpen(true) }
  function openEdit(service: CatalogService) { setEditing(service); setForm({ name: service.name, description: service.description ?? "", priceReais: centsToReais(service.priceCents), durationMinutes: String(service.durationMinutes), displayOrder: String(service.displayOrder), status: service.status, categoryId: service.category?.id ?? "" }); setFormOpen(true) }
  function openProfessionals(service: CatalogService) { setProfessionalsService(service); setSelectedProfessionals(service.professionals.map(({ professional }) => professional.id)) }

  async function submitForm(event: FormEvent) { event.preventDefault(); const normalized = normalizeServicePayload(form); if (normalized.error) return void toast.error(normalized.error); setSubmitting(true); try { const response = await fetch(editing ? `/api/services/${editing.id}` : "/api/services", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(normalized.payload) }); if (!response.ok) return void toast.error(safeApiMessage(response.status)); await loadCatalog(); setFormOpen(false); toast.success(editing ? "Serviço atualizado." : "Serviço criado.") } catch { toast.error("Não foi possível conectar ao servidor. Tente novamente.") } finally { setSubmitting(false) } }
  async function saveProfessionals() { if (!professionalsService) return; setSubmitting(true); try { const response = await fetch(`/api/services/${professionalsService.id}/professionals`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ professionalIds: selectedProfessionals }) }); if (!response.ok) return void toast.error(safeApiMessage(response.status)); await loadCatalog(); setProfessionalsService(null); toast.success("Profissionais associados com sucesso.") } catch { toast.error("Não foi possível conectar ao servidor. As associações anteriores foram preservadas.") } finally { setSubmitting(false) } }
  async function changeStatus(service: CatalogService) { setSubmitting(true); try { const response = await fetch(`/api/services/${service.id}`, { method: service.status === "ACTIVE" ? "DELETE" : "PUT", headers: { "Content-Type": "application/json" }, ...(service.status === "INACTIVE" ? { body: JSON.stringify({ status: "ACTIVE" }) } : {}) }); if (!response.ok) return void toast.error(safeApiMessage(response.status)); await loadCatalog(); toast.success(service.status === "ACTIVE" ? "Serviço inativado." : "Serviço reativado.") } catch { toast.error("Não foi possível conectar ao servidor. Tente novamente.") } finally { setSubmitting(false) } }

  if (loading) return <ServicesLoading visible={showLoading} />
  return <div className="min-h-screen p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[90rem] space-y-7"><ServicesSettingsHeader />{loadError ? <Card><CardContent className="flex flex-col items-center gap-4 py-12 text-center"><p className="text-muted-foreground">Não foi possível carregar o catálogo e a equipe.</p><Button variant="outline" onClick={() => void loadCatalog()}><RefreshCw aria-hidden="true" />Tentar novamente</Button></CardContent></Card> : <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]"><ServiceCatalogPanel packages={packages} categories={categories} reload={loadCatalog} services={services} filtered={filtered} query={query} submitting={submitting} onQuery={setQuery} onNew={openNew} onEdit={openEdit} onProfessionals={openProfessionals} onStatus={(service) => void changeStatus(service)} /><TeamPanel services={services} professionals={professionals} /></div>}</div><ServiceFormDialog categories={categories} open={formOpen} service={editing} values={form} submitting={submitting} onOpenChange={setFormOpen} onChange={setForm} onSubmit={submitForm} /><ProfessionalsDialog service={professionalsService} professionals={professionals} selected={selectedProfessionals} submitting={submitting} onOpenChange={(open) => !open && setProfessionalsService(null)} onSelectedChange={setSelectedProfessionals} onSave={saveProfessionals} /></div>
}
