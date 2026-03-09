"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type HeaderConfig = {
  title: string
  subtitle?: string
  right?: React.ReactNode // área de ações (botões/filtros)
}

export const headerConfig: Record<string, HeaderConfig> = {
  "/dashboard": {
    title: "Agenda",
    subtitle: "Gerencie horários e atendimentos",
  },

  "/dashboard/agenda": {
    title: "Checkouts",
    subtitle: "Gerencie pagamentos e vendas",
    right: (
      <div className="flex items-center gap-2">
        <Input placeholder="Buscar cliente..." className="h-9 w-[180px] lg:w-[260px]" />
        <Button className="h-9">Novo agendamento</Button>
      </div>
    ),
  },

 

  "/dashboard/caixa": {
    title: "Caixa",
    subtitle: "Entradas, saídas e fechamento",
    right: (
      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-9">Registrar saída</Button>
        <Button className="h-9">Registrar entrada</Button>
      </div>
    ),
  },
}
