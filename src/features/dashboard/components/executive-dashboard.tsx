"use client"
import { useEffect, useState } from "react"
import { FileDown, Printer, Sheet } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { DashboardFilters, type Filters } from "./dashboard-filters"
import { DashboardMetrics } from "./dashboard-metrics"
import { DashboardReports } from "./dashboard-reports"
import { DashboardError, DashboardLoading } from "./dashboard-states"
import type { DashboardSummary } from "../types"

export function ExecutiveDashboard() {
  const [filters, setFilters] = useState<Filters>({ period: "month", start: "", end: "", professionalId: "", compare: false })
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true); setError("")
      const params = new URLSearchParams({ executive: "true", period: filters.period, compare: String(filters.compare) })
      if (filters.professionalId) params.set("professionalId", filters.professionalId)
      if (filters.period === "custom") { params.set("start", filters.start); params.set("end", filters.end) }
      try {
        const response = await fetch(`/api/dashboard/summary?${params}`, { signal: controller.signal, cache: "no-store" })
        const body = await response.json()
        if (!response.ok) throw new Error(body.message ?? "Não foi possível carregar o dashboard.")
        if (!controller.signal.aborted) setData(body)
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o dashboard.") }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [filters, revision])
  return <div className="min-h-screen p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl space-y-5"><header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5"><div className="flex items-start gap-3"><SidebarTrigger /><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">● Visão da operação</p><h1 className="mt-1 text-2xl font-bold">Dashboard Executivo</h1><p className="mt-1 text-sm text-muted-foreground">Acompanhe o desempenho da sua barbearia.</p></div></div><div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled><FileDown className="size-4" />Exportar PDF</Button><Button variant="outline" size="sm" disabled><Sheet className="size-4" />Exportar Excel</Button><Button variant="outline" size="sm" disabled><Printer className="size-4" />Imprimir</Button></div><p className="mt-2 text-xs text-muted-foreground">Exportações disponíveis em uma próxima etapa.</p></div></header><DashboardFilters value={filters} onChange={setFilters} professionals={data?.professionals ?? []} /><div aria-live="polite" aria-busy={loading}>{loading ? <DashboardLoading /> : error ? <DashboardError message={error} retry={() => setRevision(n => n + 1)} /> : data && <div className="space-y-5"><p className="text-xs text-muted-foreground">{data.period.start} — {data.period.end} · {data.period.timezone}{data.compare && ` · Comparação: ${data.period.previousStart} — ${data.period.previousEnd}`}</p>{data.metrics.newCustomers === 0 && <p role="status" className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum novo cliente no período selecionado.</p>}<DashboardMetrics data={data} /><DashboardReports data={data} /></div>}</div></div></div>
}
