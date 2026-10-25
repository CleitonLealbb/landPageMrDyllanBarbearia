import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Session } from "@/lib/auth/session"
import { dashboardPeriod } from "./period"
import { checkoutFinance } from "./checkout-finance"

export async function executiveSummary(request: Request, session: Session | null) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
  if (!session) return json({ message: "Não autenticado." }, 401)
  if (session.tenantRole !== "BARBERSHOP_OWNER" || !session.barbershopId) return json({ message: "Sem permissão para o Dashboard Executivo." }, 403)
  const barbershopId = session.barbershopId
  const shop = await prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { timezone: true, status: true } })
  if (!shop || shop.status !== "ACTIVE") return json({ message: "Barbearia indisponível." }, 404)
  const params = new URL(request.url).searchParams
  params.delete("executive")
  let period: ReturnType<typeof dashboardPeriod>
  try { period = dashboardPeriod(params, shop.timezone) } catch { return json({ message: "Filtros inválidos. Use um período válido de até 366 dias." }, 400) }
  const professionalId = params.get("professionalId")
  if (professionalId !== null && (!professionalId || professionalId.length > 100)) return json({ message: "Profissional inválido." }, 400)
  const professionals = await prisma.professional.findMany({ where: { barbershopId }, select: { id: true, name: true, commission: true }, orderBy: { name: "asc" } })
  if (professionalId && !professionals.some(p => p.id === professionalId)) return json({ message: "Profissional inválido." }, 400)
  // Customer registrations have no professional association. Never present a tenant total as a professional metric.
  const counts = professionalId ? null : await prisma.$transaction([
    prisma.barbershopCustomer.count({ where: { barbershopId, createdAt: period.current } }),
    prisma.barbershopCustomer.count({ where: { barbershopId, status: "ACTIVE", createdAt: { lt: period.current.lt } } }),
    ...(period.compare ? [prisma.barbershopCustomer.count({ where: { barbershopId, createdAt: period.previous } })] : []),
  ])
  const finance = await prisma.$transaction(tx => checkoutFinance(tx, barbershopId, period, professionalId), { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 20000 })
  return json({ period: { start: period.start, end: period.end, timezone: period.timezone, previousStart: period.previousStart, previousEnd: period.previousEnd }, compare: period.compare, professionalId, professionals, finance, metrics: { grossCents: finance.current.paidTotalCents, netCents: null, appointments: null, averageTicketCents: finance.current.averageTicketCents, servedCustomers: null, newCustomers: counts?.[0] ?? null, cancellations: null, occupancy: null, activeCustomers: counts?.[1] ?? null, previousNewCustomers: period.compare ? counts?.[2] ?? null : null } })
}
