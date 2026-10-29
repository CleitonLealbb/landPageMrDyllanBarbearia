import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { canAccess } from "@/lib/permissions"
import { RegisterManager } from "@/features/checkout/components/register-manager"

export default async function RegisterSettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!canAccess(session.tenantRole, "checkout:registers")) redirect("/dashboard")
  return <main className="mx-auto w-full min-w-0 max-w-4xl space-y-6 p-4 sm:p-6"><Link href="/dashboard/configuracoes" className="text-sm text-primary underline">Configurações</Link><h1 className="text-2xl font-bold">Caixa e PDV</h1><RegisterManager /></main>
}
