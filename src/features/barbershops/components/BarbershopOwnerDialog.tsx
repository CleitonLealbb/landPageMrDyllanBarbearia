"use client"

import type { FormEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@radix-ui/react-label"
import type { Barbershop } from "./types"

type BarbershopOwnerDialogProps = {
  open: boolean
  selectedBarbershop: Barbershop | null
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent) => void
  onOwnerNameChange: (value: string) => void
  onOwnerEmailChange: (value: string) => void
  onOwnerPasswordChange: (value: string) => void
}

export function BarbershopOwnerDialog({
  open,
  selectedBarbershop,
  ownerName,
  ownerEmail,
  ownerPassword,
  onOpenChange,
  onSubmit,
  onOwnerNameChange,
  onOwnerEmailChange,
  onOwnerPasswordChange,
}: BarbershopOwnerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#171717] text-white">
        <DialogHeader>
          <DialogTitle>Cadastrar Dono da Barbearia</DialogTitle>

          <DialogDescription>
            Vincule um dono responsÃ¡vel pela barbearia selecionada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
            Barbearia:{" "}
            <span className="font-semibold text-white">
              {selectedBarbershop?.name}
            </span>
          </div>

          <div className="space-y-2">
            <Label>Nome do dono</Label>
            <Input
              value={ownerName}
              onChange={(e) => onOwnerNameChange(e.currentTarget.value)}
              placeholder="Ex: Cleiton Leal"
            />
          </div>

          <div className="space-y-2">
            <Label>E-mail do dono</Label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => onOwnerEmailChange(e.currentTarget.value)}
              placeholder="dono@barbearia.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Senha temporÃ¡ria</Label>
            <Input
              type="password"
              value={ownerPassword}
              onChange={(e) => onOwnerPasswordChange(e.currentTarget.value)}
              placeholder="Senha inicial"
            />
          </div>

          <Button className="w-full bg-yellow-500 text-black hover:bg-yellow-400">
            Vincular Dono
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
