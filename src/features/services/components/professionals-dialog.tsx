"use client"

import { Check, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { CatalogService, ProfessionalOption } from "../types"

type Props = { service: CatalogService | null; professionals: ProfessionalOption[]; selected: string[]; submitting: boolean; onOpenChange: (open: boolean) => void; onSelectedChange: (ids: string[]) => void; onSave: () => void }

export function ProfessionalsDialog({ service, professionals, selected, submitting, onOpenChange, onSelectedChange, onSave }: Props) {
  function toggle(id: string) { onSelectedChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]) }
  return (
    <Dialog open={Boolean(service)} onOpenChange={(open) => !submitting && onOpenChange(open)}>
      <DialogContent className="border-border bg-card sm:max-w-lg">
        <DialogHeader><DialogTitle>Profissionais</DialogTitle><DialogDescription>Selecione quem poderá executar “{service?.name}”. É permitido não selecionar ninguém.</DialogDescription></DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto py-1">
          {professionals.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum profissional disponível.</p> : professionals.map((professional) => {
            const checked = selected.includes(professional.id)
            return <button type="button" key={professional.id} onClick={() => toggle(professional.id)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${checked ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`} aria-pressed={checked}>
              <span className="flex size-9 items-center justify-center rounded-full bg-muted"><UserRound className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{professional.name}</span><span className="block truncate text-xs text-muted-foreground">{professional.role}</span></span>{checked ? <Check className="size-5 text-primary" /> : null}
            </button>
          })}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button><Button onClick={onSave} disabled={submitting}>{submitting ? "Salvando..." : `Salvar (${selected.length})`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
