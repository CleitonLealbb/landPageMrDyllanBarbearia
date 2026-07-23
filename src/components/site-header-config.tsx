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
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
        <Input
          placeholder="Buscar cliente..."
          className="h-9 min-w-0 flex-1 sm:w-[180px] sm:flex-none lg:w-[260px]"
        />
        <Button className="h-9 shrink-0">Novo agendamento</Button>
      </div>
    ),
  },

 

  "/dashboard/caixa": {
    title: "Caixa",
    subtitle: "Entradas, saídas e fechamento",
    right: (
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
        <Button variant="outline" className="h-9 flex-1 sm:flex-none">
          Registrar saída
        </Button>
        <Button className="h-9 flex-1 sm:flex-none">Registrar entrada</Button>
      </div>
    ),
  },
}
