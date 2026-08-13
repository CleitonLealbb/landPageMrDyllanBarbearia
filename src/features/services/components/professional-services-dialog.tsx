"use client"

import { useMemo, useState } from "react"
import { Clock3, Search, UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { filterAssignedServices, formatBRL } from "../helpers"
import type { CatalogService, ProfessionalOption } from "../types"

type Selection = { professional: ProfessionalOption; services: CatalogService[] }
type Props = { selection: Selection | null; onOpenChange: (open: boolean) => void }

export function ProfessionalServicesDialog({ selection, onOpenChange }: Props) {
  const [query, setQuery] = useState("")
  const services = useMemo(() => filterAssignedServices(selection?.services ?? [], query), [selection, query])
  const professional = selection?.professional
  return <Dialog open={Boolean(selection)} onOpenChange={(open) => { if (!open) setQuery(""); onOpenChange(open) }}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden border-border bg-card p-0 sm:max-w-2xl"><DialogHeader className="border-b border-border/60 p-5 pr-12 sm:p-6 sm:pr-12"><div className="flex items-center gap-3"><Avatar className="size-12"><AvatarImage src={professional?.photoUrl ?? undefined} alt={professional ? `Foto de ${professional.name}` : ""} /><AvatarFallback><UserRound aria-hidden="true" className="size-5 text-primary" /></AvatarFallback></Avatar><div className="min-w-0"><DialogTitle className="truncate">Serviços de {professional?.name}</DialogTitle><DialogDescription className="mt-1">{professional?.role} · {selection?.services.length ?? 0} serviço(s) atribuído(s)</DialogDescription></div></div></DialogHeader><div className="grid min-h-0 gap-4 p-5 sm:p-6"><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus aria-label={`Buscar serviços de ${professional?.name ?? "profissional"}`} className="pl-9" placeholder="Buscar em todos os serviços..." value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></div><p className="text-xs leading-5 text-muted-foreground">Para alterar as atribuições, use a ação Profissionais no card de cada serviço.</p><div className="max-h-[min(55dvh,32rem)] overflow-y-auto pr-1"><ul aria-label="Todos os serviços atribuídos" className="space-y-3">{services.map((service) => <li key={service.id}><Card className="border-border/60 shadow-none"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{service.name}</h3>{service.description && <p className="mt-1 text-sm leading-5 text-muted-foreground">{service.description}</p>}</div><Badge variant={service.status === "ACTIVE" ? "outline" : "secondary"}>{service.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><strong className="text-primary">{formatBRL(service.priceCents)}</strong><span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Clock3 aria-hidden="true" className="size-4" />{service.durationMinutes} min</span></div></CardContent></Card></li>)}</ul>{services.length === 0 && <div role="status" className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{selection?.services.length ? "Nenhum serviço encontrado." : "Sem serviços atribuídos"}</div>}</div></div></DialogContent></Dialog>
}
