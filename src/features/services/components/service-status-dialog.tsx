"use client"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import type { CatalogService } from "../types"

type Props = { service: CatalogService | null; submitting: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }

export function ServiceStatusDialog({ service, submitting, onOpenChange, onConfirm }: Props) {
  return <AlertDialog open={Boolean(service)} onOpenChange={(open) => !submitting && onOpenChange(open)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Inativar serviço</AlertDialogTitle><AlertDialogDescription>“{service?.name}” deixará de aparecer para novos agendamentos. O registro e suas informações serão preservados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); onConfirm() }} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{submitting ? "Inativando..." : "Inativar serviço"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
}
