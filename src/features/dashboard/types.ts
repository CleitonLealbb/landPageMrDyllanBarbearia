export type DashboardSummary = {
  period: { start: string; end: string; timezone: string; previousStart: string; previousEnd: string }
  compare: boolean
  professionalId: string | null
  professionals: { id: string; name: string; commission: number }[]
  metrics: { grossCents: null; netCents: null; appointments: null; averageTicketCents: null; servedCustomers: null; newCustomers: number | null; cancellations: null; occupancy: null; activeCustomers: number | null; previousNewCustomers: number | null }
}
