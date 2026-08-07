import { redirect } from "next/navigation"
import { ServicesDashboardShell } from "@/features/services/components/services-dashboard-shell"
import { getSession } from "@/lib/auth/session"

export default async function ServicesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.type !== "USER" || session.globalRole !== null || session.tenantRole !== "BARBERSHOP_OWNER") redirect("/dashboard")
  return <ServicesDashboardShell />
}
