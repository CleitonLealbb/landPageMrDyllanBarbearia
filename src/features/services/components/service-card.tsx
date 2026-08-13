import { Clock3, Edit3, ListOrdered, UserRoundCog } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { formatBRL } from "../helpers"
import type { CatalogService } from "../types"

type Props = { service: CatalogService; submitting: boolean; onEdit: () => void; onProfessionals: () => void; onStatus: () => void }

export function ServiceCard({ service, submitting, onEdit, onProfessionals, onStatus }: Props) {
  const active = service.status === "ACTIVE"
  const professionalLabel = `${service.professionals.length} ${service.professionals.length === 1 ? "profissional" : "profissionais"}`
  return <Card className={`overflow-hidden border-border/60 bg-card/80 shadow-none transition-colors focus-within:border-primary/70 ${active ? "" : "opacity-65"}`}><CardContent className="p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div className="min-w-0"><div className="flex items-start gap-3"><h3 className="min-w-0 flex-1 text-base font-semibold sm:text-lg">{service.name}</h3><div className="flex shrink-0 items-center gap-2"><span className="text-sm font-medium text-muted-foreground">{active ? "Ativo" : "Inativo"}</span><Switch checked={active} disabled={submitting} aria-label={`${active ? "Inativar" : "Reativar"} serviço ${service.name}`} onCheckedChange={(checked) => { if (checked !== active) onStatus() }} /></div></div><div className="mt-1.5"><Badge variant="outline" className="border-border/60 font-normal">{service.category?.name ?? "Sem categoria"}</Badge></div>{service.description && <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted-foreground">{service.description}</p>}</div><div className="flex items-end justify-between gap-5 sm:flex-col sm:items-end sm:gap-1"><strong className="text-xl text-primary sm:text-2xl">{formatBRL(service.priceCents)}</strong><span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Clock3 aria-hidden="true" className="size-4 text-primary" />{service.durationMinutes} min</span></div></div><div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><ListOrdered aria-hidden="true" className="size-3.5" />Ordem {service.displayOrder}</span><span className="inline-flex items-center gap-1"><UserRoundCog aria-hidden="true" className="size-3.5" />{professionalLabel}</span></div><div className="flex flex-wrap gap-1.5"><Button size="sm" variant="ghost" onClick={onEdit}><Edit3 aria-hidden="true" />Editar</Button><Button size="sm" variant="ghost" onClick={onProfessionals}><UserRoundCog aria-hidden="true" />Profissionais</Button></div></div></CardContent></Card>
}
