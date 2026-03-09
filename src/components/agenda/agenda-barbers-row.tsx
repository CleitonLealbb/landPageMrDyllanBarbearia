"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type BarberStatus = "disponivel" | "ocupado" | "ausente"

export type Barber = {
  id: string
  name: string
  avatarUrl?: string
  status: BarberStatus
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

function statusLabel(status: BarberStatus) {
  if (status === "disponivel") return "Disponível"
  if (status === "ocupado") return "Ocupado"
  return "Ausente"
}

function statusClasses(status: BarberStatus) {
  if (status === "disponivel") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
  if (status === "ocupado") return "border-amber-500/40 bg-amber-500/10 text-amber-300"
  return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300"
}

export function AgendaBarbersRow({ barbers }: { barbers: Barber[] }) {
  return (
    <div className="border-b">
      <div
        className="min-w-[700px] grid gap-2 px-2 py-2 md:px-1 sticky top-0 z-20 bg-background"
        style={{ gridTemplateColumns: "var(--agenda-cols)" }}
      >
        {/* célula da coluna "Hora" (fica alinhada com a coluna da hora da grade) */}
        <div className="sticky left-0 z-40 bg-background" />

        {/* um card por coluna */}
        {barbers.map((b) => (
          <div
            key={b.id}
            className={[
              "rounded-xl border px-2 py-2 flex items-center gap-3 min-w-0",
              statusClasses(b.status),
            ].join(" ")}
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={b.avatarUrl} alt={b.name} />
              <AvatarFallback>{initials(b.name)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{b.name}</div>
              <div className="text-xs text-muted-foreground">{statusLabel(b.status)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}