import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (
    session.type === "USER" &&
    session.globalRole === "SUPER_ADMIN"
  ) {
    redirect("/super-admin")
  }

  return <DashboardShell tenantRole={session.tenantRole}>{children}</DashboardShell>
}
