"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BarbershopCard } from "./BarbershopCard"
import { BarbershopFormDialog } from "./BarbershopFormDialog"
import { BarbershopOwnerDialog } from "./BarbershopOwnerDialog"
import type { Barbershop } from "./types"

export function BarbershopsView() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [barbershops, setBarbershops] = useState<Barbershop[]>([])
  const [editingBarbershop, setEditingBarbershop] =
    useState<Barbershop | null>(null)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [selectedBarbershop, setSelectedBarbershop] =
    useState<Barbershop | null>(null)

  const [ownerName, setOwnerName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [ownerPassword, setOwnerPassword] = useState("")

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    const url = editingBarbershop
      ? `/api/barbershops/${editingBarbershop.id}`
      : "/api/barbershops"

    const method = editingBarbershop ? "PUT" : "POST"

    const response = await fetch(url, {
      method,
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

    const shop = await response.json()

    if (editingBarbershop) {
      setBarbershops((prev) =>
        prev.map((item) =>
          item.id === shop.id ? shop : item
        )
      )
    } else {
      setBarbershops((prev) => [shop, ...prev])
    }

    setEditingBarbershop(null)
    setOpen(false)

    setName("")
    setPhone("")
    setEmail("")
    setAddress("")
    resetForm()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/barbershops/${id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      toast.error("Erro ao excluir a barbearia.")
      return
    }

    setBarbershops((prev) =>
      prev.filter((shop) => shop.id !== id)
    )

    toast.success("Barbearia excluÃ­da com sucesso.")
  }

  function resetForm() {
    setEditingBarbershop(null)
    setName("")
    setPhone("")
    setEmail("")
    setAddress("")
  }

  function handleEdit(shop: Barbershop) {
    setEditingBarbershop(shop)
    setName(shop.name)
    setPhone(shop.phone ?? "")
    setEmail(shop.email ?? "")
    setAddress(shop.address ?? "")
    setOpen(true)
  }

  function handleOpenOwner(shop: Barbershop) {
    setSelectedBarbershop(shop)
    setOwnerName("")
    setOwnerEmail("")
    setOwnerPassword("")
    setOwnerOpen(true)
  }

  async function handleCreateOwner(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedBarbershop) return

    const response = await fetch(
      `/api/barbershops/${selectedBarbershop.id}/owner`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: ownerName,
          email: ownerEmail,
          password: ownerPassword,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      alert(error.message)
      return
    }

    setOwnerOpen(false)
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
      <BarbershopFormDialog
        open={open}
        editingBarbershop={editingBarbershop}
        name={name}
        phone={phone}
        email={email}
        address={address}
        onOpenChange={setOpen}
        onResetForm={resetForm}
        onSubmit={handleCreate}
        onNameChange={setName}
        onPhoneChange={setPhone}
        onEmailChange={setEmail}
        onAddressChange={setAddress}
      />

      {barbershops.map((shop) => (
        <BarbershopCard
          key={shop.id}
          shop={shop}
          onEdit={handleEdit}
          onOpenOwner={handleOpenOwner}
          onDelete={handleDelete}
        />
      ))}

      <BarbershopOwnerDialog
        open={ownerOpen}
        selectedBarbershop={selectedBarbershop}
        ownerName={ownerName}
        ownerEmail={ownerEmail}
        ownerPassword={ownerPassword}
        onOpenChange={setOwnerOpen}
        onSubmit={handleCreateOwner}
        onOwnerNameChange={setOwnerName}
        onOwnerEmailChange={setOwnerEmail}
        onOwnerPasswordChange={setOwnerPassword}
      />
    </div>
  )
}
