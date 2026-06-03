"use client"

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@radix-ui/react-dialog"
import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { DialogHeader } from "../ui/dialog"
import { Label } from "@radix-ui/react-label"
import { Input } from "../ui/input"


type Barbershop = {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  status: string
}


export function BarbershopsView() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [barbershops, setBarbershops] = useState<Barbershop[]>([])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    const response = await fetch("/api/barbershops", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        phone,
        email,
        address,
      }),
    })

    if (!response.ok) return

    const newShop = await response.json()

    setBarbershops((prev) => [newShop, ...prev])
    setOpen(false)

    setName("")
    setPhone("")
    setEmail("")
    setAddress("")
  }
  useEffect(() => {
    async function load() {
      const response = await fetch("/api/barbershops")

      if (!response.ok) return

      const data = await response.json()

      setBarbershops(data)
    }

    load()
  }, [])

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-yellow-500 text-black hover:bg-yellow-400">
            Nova Barbearia
          </Button>
        </DialogTrigger>

        <DialogContent className="border-white/10 bg-[#171717] text-white">
          <DialogHeader>
            <DialogTitle>Cadastrar Barbearia</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da barbearia</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder="Ex: Mr Dyllan Barbearia"
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
                placeholder="(66) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="contato@barbearia.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.currentTarget.value)}
                placeholder="Rua, número, bairro, cidade"
              />
            </div>

            <Button className="w-full bg-yellow-500 text-black hover:bg-yellow-400">
              Cadastrar Barbearia
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {barbershops.map((shop) => (
        <div
          key={shop.id}
          className="rounded-xl border border-white/10 bg-[#171717] p-4"
        >
          <h3 className="font-semibold text-white">
            {shop.name}
          </h3>

          <p className="text-sm text-zinc-400">
            {shop.email}
          </p>

          <p className="text-sm text-zinc-400">
            {shop.phone}
          </p>

          <p className="text-xs text-yellow-500">
            {shop.status}
          </p>
        </div>
      ))}
    </div>
  )
}