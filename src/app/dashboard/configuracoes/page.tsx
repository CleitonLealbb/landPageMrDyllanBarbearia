import { redirect } from "next/navigation"
import { SettingsDashboardShell } from "@/features/settings/components/settings-dashboard-shell"
import { getSession } from "@/lib/auth/session"
import { canAccess } from "@/lib/permissions"
export default async function SettingsPage() { const session = await getSession(); if (!session) redirect("/login"); if (!canAccess(session.tenantRole, "settings:view")) redirect("/dashboard"); return <SettingsDashboardShell /> }
