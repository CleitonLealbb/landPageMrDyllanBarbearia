"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type DeleteBarbershopDialogProps = {
  barbershopName: string
  onDelete: () => void
}

export function DeleteBarbershopDialog({
  barbershopName,
  onDelete,
}: DeleteBarbershopDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="border-red-500/30 text-red-400"
        >
          Excluir
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="border-white/10 bg-[#171717] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir Barbearia
          </AlertDialogTitle>

          <AlertDialogDescription>
            Tem certeza que deseja excluir "{barbershopName}"?
            Esta aÃ§Ã£o nÃ£o poderÃ¡ ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-yellow/50 text-white hover:bg-white/20">
            Cancelar
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={onDelete}
            className="bg-red-500 text-white hover:bg-red-400"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
