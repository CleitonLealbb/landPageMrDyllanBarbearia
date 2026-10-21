"use client"

import { useState } from "react"
import { CalendarClock, Eye, UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getAssignedServicesSummary, groupServicesByProfessional } from "../helpers"
import type { CatalogService, ProfessionalOption } from "../types"
import { ProfessionalServicesDialog } from "./professional-services-dialog"

type Selection = { professional: ProfessionalOption; services: CatalogService[] }
type Props = { services: CatalogService[]; professionals: ProfessionalOption[] }

export function TeamPanel({ services, professionals }: Props) {
  const members = groupServicesByProfessional(services, professionals)
  const [selection, setSelection] = useState<Selection | null>(null)
  return <aside aria-labelledby="team-title" className="min-w-0 border-t border-border/50 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><div><h2 id="team-title" className="text-xl font-semibold">Equipe</h2><p className="mt-1 text-sm text-muted-foreground">Associações atuais do catálogo.</p></div><div className="mt-5 space-y-3">{members.length === 0 ? <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">Nenhum profissional disponível.</div> : members.map(({ professional, services: assigned }) => { const summary = getAssignedServicesSummary(assigned); const serviceCount = `${assigned.length} ${assigned.length === 1 ? "serviço atribuído" : "serviços atribuídos"}`; return <Card key={professional.id} className="border-border/60 bg-card/80 shadow-none focus-within:border-primary/70"><CardContent className="p-4"><div className="flex items-center gap-3"><Avatar className="size-11"><AvatarImage src={professional.photoUrl ?? undefined} alt={`Foto de ${professional.name}`} /><AvatarFallback><UserRound aria-hidden="true" className="size-5 text-primary" /></AvatarFallback></Avatar><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{professional.name}</h3><p className="truncate text-sm text-muted-foreground">{professional.role}</p><p className="mt-0.5 text-xs text-muted-foreground">{serviceCount}</p></div><Badge variant="secondary" aria-label={serviceCount} className="shrink-0">{assigned.length}</Badge></div><div className="mt-4 flex flex-wrap gap-1.5">{summary.empty ? <span className="text-xs text-muted-foreground">Sem serviços atribuídos</span> : summary.visible.map((service) => <Badge key={service.id} variant="outline" className="h-auto max-w-full whitespace-normal break-words border-border/70 py-1 text-left font-normal leading-4">{service.name}</Badge>)}{summary.remaining > 0 && <span className="self-center text-xs text-muted-foreground">+ {summary.remaining} {summary.remaining === 1 ? "outro" : "outros"}</span>}</div><Button aria-label={`Ver serviços de ${professional.name}`} className="mt-4 w-full border-border/70" size="sm" variant="outline" onClick={() => setSelection({ professional, services: assigned })}><Eye aria-hidden="true" />Ver serviços</Button></CardContent></Card> })}</div><div className="mt-5 rounded-xl border border-dashed border-border/60 p-5"><div className="flex flex-wrap items-center gap-2"><CalendarClock aria-hidden="true" className="size-5 text-primary" /><h3 className="font-semibold">Escalas de trabalho</h3><Badge variant="secondary">Em breve</Badge></div><p className="mt-2 text-sm leading-6 text-muted-foreground">Disponibilidade e jornadas semanais poderão ser configuradas após a implementação das escalas.</p></div><ProfessionalServicesDialog selection={selection} onOpenChange={(open) => !open && setSelection(null)} /></aside>
}
