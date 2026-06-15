"use client"

import { BarbershopsView } from "@/components/views/barbershops-view"
import { useEffect, useState } from "react"

export function SuperAdminClient() {
  const [summary, setSummary] = useState({
    barbershops: 0,
    owners: 0,
    professionals: 0,
    revenue: 0,
  })

  useEffect(() => {
    async function loadSummary() {
      const response = await fetch("/api/dashboard/summary")

      if (!response.ok) return

      const data = await response.json()

      setSummary(data)
    }

    loadSummary()
  }, [])

  return (
    <main className="min-h-screen bg-[#111111] p-6 text-white">
      <div className="mb-8">
        <p className="text-sm text-yellow-500">Painel SaaS</p>
        <h1 className="text-3xl font-bold">Super Admin</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Gerencie barbearias, donos, planos e crescimento da plataforma.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Barbearias" value={summary.barbershops.toString()} />
        <Card title="Donos" value={summary.owners.toString()} />
        <Card title="Profissionais" value={summary.professionals.toString()} />
        <Card title="Receita SaaS" value={`R$ ${summary.revenue.toFixed(2)}`} />
      </div>

      <section className="mt-8 rounded-2xl border border-white/10 bg-[#171717] p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">
            Barbearias cadastradas
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Gerencie as barbearias cadastradas na plataforma.
          </p>
        </div>

        <BarbershopsView />
      </section>
    </main>
  )
}

function Card({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#171717] p-5">
      <p className="text-sm text-zinc-400">{title}</p>
      <h3 className="mt-3 text-2xl font-bold">{value}</h3>
    </div>
  )
}
