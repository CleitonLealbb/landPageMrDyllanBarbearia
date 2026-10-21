import { redirect } from "next/navigation"
import { ServicesDashboardShell } from "@/features/services/components/services-dashboard-shell"
import { getSession } from "@/lib/auth/session"
import { canAccess } from "@/lib/permissions"
export default async function SettingsServicesPage() { const session = await getSession(); if (!session) redirect("/login"); if (!canAccess(session.tenantRole, "services:view")) redirect("/dashboard"); return <ServicesDashboardShell /> }
