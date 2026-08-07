"use client"

import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CatalogService, ServiceFormValues, ServiceStatus } from "../types"

type Props = {
  open: boolean
  service: CatalogService | null
  values: ServiceFormValues
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onChange: (values: ServiceFormValues) => void
  onSubmit: (event: FormEvent) => void
}

export function ServiceFormDialog({ open, service, values, submitting, onOpenChange, onChange, onSubmit }: Props) {
  const update = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) => onChange({ ...values, [key]: value })

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>Os dados serão usados no catálogo exibido aos clientes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="service-name">Nome</Label><Input id="service-name" value={values.name} onChange={(e) => update("name", e.currentTarget.value)} maxLength={120} required /></div>
          <div className="space-y-2"><Label htmlFor="service-description">Descrição (opcional)</Label><Textarea id="service-description" value={values.description} onChange={(e) => update("description", e.currentTarget.value)} maxLength={500} rows={3} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="service-price">Preço em reais</Label><Input id="service-price" inputMode="decimal" placeholder="50,00" value={values.priceReais} onChange={(e) => update("priceReais", e.currentTarget.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="service-duration">Duração (minutos)</Label><Input id="service-duration" type="number" min={1} step={1} value={values.durationMinutes} onChange={(e) => update("durationMinutes", e.currentTarget.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="service-order">Ordem de exibição</Label><Input id="service-order" type="number" min={0} step={1} value={values.displayOrder} onChange={(e) => update("displayOrder", e.currentTarget.value)} required /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={values.status} onValueChange={(value: ServiceStatus) => update("status", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Ativo</SelectItem><SelectItem value="INACTIVE">Inativo</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar serviço"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
