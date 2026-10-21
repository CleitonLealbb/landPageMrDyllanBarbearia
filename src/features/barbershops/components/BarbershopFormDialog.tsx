"use client"

import type { FormEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@radix-ui/react-label"
import type { Barbershop } from "./types"

type BarbershopFormDialogProps = {
  open: boolean
  editingBarbershop: Barbershop | null
  name: string
  phone: string
  email: string
  address: string
  onOpenChange: (open: boolean) => void
  onResetForm: () => void
  onSubmit: (event: FormEvent) => void
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onEmailChange: (value: string) => void
  onAddressChange: (value: string) => void
}

export function BarbershopFormDialog({
  open,
  editingBarbershop,
  name,
  phone,
  email,
  address,
  onOpenChange,
  onResetForm,
  onSubmit,
  onNameChange,
  onPhoneChange,
  onEmailChange,
  onAddressChange,
}: BarbershopFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value)

        if (!value) {
          onResetForm()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          onClick={() => {
            onResetForm()
            onOpenChange(true)
          }}
          className="bg-yellow-500 text-black hover:bg-yellow-400"
        >
          Nova Barbearia
        </Button>
      </DialogTrigger>

      <DialogContent className="border-white/10 bg-[#171717] text-white">
        <DialogHeader>
          <DialogTitle>
            {editingBarbershop
              ? "Editar Barbearia"
              : "Cadastrar Barbearia"}
          </DialogTitle>

          <DialogDescription>
            {editingBarbershop
              ? "Atualize as informaÃ§Ãµes da barbearia."
              : "Preencha os dados para cadastrar uma nova barbearia."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da barbearia</Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.currentTarget.value)}
              placeholder="Ex: Mr Dyllan Barbearia"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => onPhoneChange(e.currentTarget.value)}
              placeholder="(66) 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              value={email}
              onChange={(e) => onEmailChange(e.currentTarget.value)}
              placeholder="contato@barbearia.com"
            />
          </div>

          <div className="space-y-2">
            <Label>EndereÃ§o</Label>
            <Input
              value={address}
              onChange={(e) => onAddressChange(e.currentTarget.value)}
              placeholder="Rua, nÃºmero, bairro, cidade"
            />
          </div>

          <Button className="w-full bg-yellow-500 text-black hover:bg-yellow-400">
            {editingBarbershop ? "Salvar AlteraÃ§Ãµes" : "Cadastrar Barbearia"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
