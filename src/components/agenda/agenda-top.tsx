"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, PanelRight } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { AgendaRightPanel } from "../agenda/agenda-right-panel"
import { SidebarTrigger } from "../ui/sidebar"

type Mode = "today" | "week" | "month"

type AgendaTopProps = {
  onToggleRight?: () => void
}

function formatPtBr(date: Date) {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date)
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date)
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "")
  const year = new Intl.DateTimeFormat("pt-BR", { year: "numeric" }).format(date)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return `${cap(weekday)}, ${day} ${cap(month)}, ${year}`
}

export function AgendaTop({ onToggleRight }: AgendaTopProps) {
  const [mode, setMode] = useState<Mode>("today")
  const [date, setDate] = useState(() => new Date())

  const label = useMemo(() => formatPtBr(date), [date])

  function addDays(days: number) {
    setDate((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + days)
      return next
    })
  }

  return (
    <div className="ml-0 mt-2 sm:ml-5 sm:mt-5">
     <SidebarTrigger />
    <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-3 sm:flex-nowrap sm:px-4">

      {/* Esquerda: navegação + data */}
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => addDays(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{label}</div>
        </div>

        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => addDays(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop: Tabs */}
      <div className="hidden md:block">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="h-8 rounded-md">
            <TabsTrigger value="today" className="px-2">Hoje</TabsTrigger>
            <TabsTrigger value="week" className="px-2">Semana</TabsTrigger>
            <TabsTrigger value="month" className="px-2">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Direita: botões */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Desktop (xl+): toggle do painel fixo */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="hidden xl:inline-flex h-8 w-8"
          onClick={onToggleRight}
          aria-label="Abrir/fechar painel"
        >
          <PanelRight className="h-5 w-5" />
        </Button>

        {/* Mobile/Notebook: abre Sheet */}
        <div className="xl:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Abrir resumo">
                <PanelRight className="h-5 w-5" />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-[calc(100vw-2rem)] max-w-[380px] sm:w-[380px]"
            >
              <SheetHeader>
                <SheetTitle>Resumo</SheetTitle>
              </SheetHeader>

              <div className="mt-4">
                <AgendaRightPanel />

              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
    </div>
  )
}
