"use client"

import type { Barber } from "./agenda-barbers-row"

type CalendarEvent = {
  id: string
  barberId: string
  title: string
  start: string
  end: string
  type?: "APPOINTMENT" | "BLOCK"
}

const startHour = 8
const endHour = 20
const pxPerHour = 80
const divisions = 4 // 15min
const pxPerMinute = pxPerHour / 60

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

export function AgendaGrid({
  barbers,
  events,
}: {
  barbers: Barber[]
  events: CalendarEvent[]
}) {
  const dayStartMin = startHour * 60
  const gridHeight = (endHour - startHour) * pxPerHour
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  // total de linhas (ex: 12h * 4 = 48 linhas)
  const totalLines = (endHour - startHour) * divisions

  return (
    <div
      className="min-w-[900px] grid relative"
      style={{ gridTemplateColumns: "var(--agenda-cols)" }}
    >
      {/* BACKGROUND LINES: desenha UMA vez só atravessando tudo */}
      <div className="absolute inset-0 z-0" style={{ height: gridHeight }}>
        {Array.from({ length: totalLines + 1 }).map((_, i) => {
          const top = i * (pxPerHour / divisions)
          const isHour = i % divisions === 0
          return (
            <div
              key={i}
              className={
                isHour
                  ? "absolute left-0 right-0 border-t border-white/20"
                  : "absolute left-0 right-0 border-t border-dashed border-white/10"
              }
              style={{ top }}
            />
          )
        })}
      </div>

      {/* COLUNA HORAS (só texto, sem linhas próprias) */}
      <div className="relative z-10 sticky left-0 bg-background border-r border-white/15" style={{ height: gridHeight }}>
        {hours.map((h) => {
          const top = (h * 60 - dayStartMin) * pxPerMinute
          return (
            <div key={h} className="absolute left-0 right-0" style={{ top }}>
              <div className="text-[11px] text-muted-foreground px-2 -translate-y-2">
                {String(h).padStart(2, "0")}:00
              </div>
            </div>
          )
        })}
      </div>

      {/* COLUNAS BARBEIROS */}
      {barbers.map((b) => (
        <div key={b.id} className="relative z-10 border-l border-white/15" style={{ height: gridHeight }}>
          {/* Eventos */}
          {events
            .filter((e) => e.barberId === b.id)
            .map((e) => {
              const s = toMinutes(e.start)
              const en = toMinutes(e.end)
              const top = (s - dayStartMin) * pxPerMinute
              const height = Math.max((en - s) * pxPerMinute, 18)
              const isBlock = e.type === "BLOCK"

              return (
                <div
                  key={e.id}
                  className={[
                    "absolute left-2 right-2 rounded-lg p-2 text-xs shadow-sm border",
                    isBlock ? "bg-muted" : "bg-primary text-primary-foreground",
                  ].join(" ")}
                  style={{ top, height }}
                >
                  <div className="font-semibold leading-tight">{e.title}</div>
                  <div className={isBlock ? "text-accent" : "opacity-90"}>
                    {e.start}–{e.end}
                  </div>
                </div>
              )
            })}
        </div>
      ))}
    </div>
  )
}
