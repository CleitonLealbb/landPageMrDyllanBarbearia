"use client"

import { useMemo, useState } from "react"
import { AgendaBarbersRow, type Barber } from "../agenda/agenda-barbers-row"
import { AgendaRightPanel } from "../agenda/agenda-right-panel"
import { AgendaTop } from "../agenda/agenda-top"
import { AgendaGrid } from "../agenda/agenda-grid"

function agendaCols(barbersCount: number): string {
  return `40px repeat(${barbersCount}, minmax(200px, 1fr))`
}

export function AgendaView() {
  const [rightOpen, setRightOpen] = useState(true)

  // ⚠️ aqui vai vir do seu banco depois
  const barbers: Barber[] = useMemo(
    () => [
      { id: "b1", name: "Cleiton L.", status: "ocupado" },
      { id: "b2", name: "Fabíola B.", status: "ocupado" },
      { id: "b3", name: "Fabrício B.", status: "disponivel" },
      { id: "b4", name: "José V", status: "disponivel" },
    ],
    []
  )

  const events = useMemo(
    () => [
      { id: "e1", barberId: "b1", title: "Corte • João", start: "09:00", end: "09:40", type: "APPOINTMENT" as const },
      { id: "e2", barberId: "b2", title: "Barba • Maria", start: "10:15", end: "10:45", type: "APPOINTMENT" as const },
      { id: "e3", barberId: "b3", title: "Almoço", start: "12:00", end: "13:00", type: "BLOCK" as const },
    ],
    []
  )

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* ESQUERDA */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topo fixo */}
        <div className="shrink-0">
          <AgendaTop onToggleRight={() => setRightOpen((v) => !v)} />
        </div>

        {/* AGENDA */}
        <div className="min-h-0 flex-1 ">
        
          {/* ✅ 1 container que controla o scroll horizontal pro header + grid */}
          <div
            className="h-full max-w-full overflow-auto overscroll-contain scrollbar-hide"
            style={
              {
                "--agenda-cols": agendaCols(barbers.length),
              } as React.CSSProperties
            }
          >
          
            <AgendaBarbersRow barbers={barbers} />
            <AgendaGrid barbers={barbers} events={events} />
          </div>
        </div>
      </div>

      {/* DIREITA */}
      {rightOpen && (
        <aside className="hidden xl:flex w-[340px] shrink-0 bg-gray shadow-sm">
        
          <div className="h-full w-full pr-6">
            <div className="flex h-full flex-col bg-background">
              <div className="flex items-left justify-end px-4 py-3">
                <button
                  onClick={() => setRightOpen(false)}
                  className="h-8 w-8 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 scrollbar-hidden">
                <AgendaRightPanel />
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
