import { getSession } from "@/lib/auth/session"
import { canAccess } from "@/lib/permissions"
import { check } from "./errors"
import type { CheckoutPermission, Context } from "./authorization"

export async function authorize(permission: CheckoutPermission): Promise<Context> {
  const session = await getSession()
  check(session, 401, "Não autenticado.")
  check(session.barbershopId && session.tenantRole && canAccess(session.tenantRole, permission), 403, "Acesso negado.")
  return { session: session as Context["session"], barbershopId: session.barbershopId }
}
