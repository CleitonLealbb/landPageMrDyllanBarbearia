import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { SuperAdminClient } from "./super-admin-client"

export default async function SuperAdminPage() {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (
    session.type !== "USER" ||
    session.role !== "SUPER_ADMIN"
  ) {
    redirect("/dashboard")
  }

  return <SuperAdminClient />
}
