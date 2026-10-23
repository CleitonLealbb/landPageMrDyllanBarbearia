import type { CheckoutDatabase } from "./client"
import type { Session } from "@/lib/auth/claims"
import { canAccess } from "@/lib/permissions"
import { check } from "./errors"

export type CheckoutPermission = "checkout:sales" | "checkout:cash" | "checkout:cancel" | "checkout:discount"
export type Context = { session: Exclude<Session, { globalRole: "SUPER_ADMIN" }>; barbershopId: string }
export function allowDiscount(ctx: Context, discount: unknown) {
  check(!discount || canAccess(ctx.session.tenantRole, "checkout:discount"), 403, "Desconto manual exige proprietário.")
}
export async function identity(tx: CheckoutDatabase, ctx: Context) {
  const { session, barbershopId } = ctx
  if (session.type === "PROFESSIONAL") {
    const professional = await tx.professional.findFirst({ where: { id: session.professionalId, barbershopId, status: "ACTIVE", userId: null, permissionLevel: session.tenantRole }, select: { id: true, name: true } })
    check(professional, 403, "Acesso negado.")
    return { identityType: "PROFESSIONAL" as const, userId: null, professionalId: professional.id, nameSnapshot: professional.name, roleSnapshot: session.tenantRole, ownProfessionalId: professional.id }
  }
  const membership = await tx.barbershopUser.findFirst({ where: { userId: session.userId, barbershopId, role: session.tenantRole, barbershop: { status: "ACTIVE" } }, select: { user: { select: { name: true } } } })
  check(membership, 403, "Acesso negado.")
  let ownProfessionalId: string | null = null
  if (session.tenantRole === "BARBER") {
    const professional = await tx.professional.findFirst({ where: { userId: session.userId, barbershopId, status: "ACTIVE" }, select: { id: true } })
    check(professional, 403, "Perfil profissional não disponível.")
    ownProfessionalId = professional.id
  }
  return { identityType: "USER" as const, userId: session.userId, professionalId: null, nameSnapshot: membership.user.name, roleSnapshot: session.tenantRole, ownProfessionalId }
}
export type Identity = Awaited<ReturnType<typeof identity>>
export function ownOperation(ctx: Context, actor: Identity, components: { professionalId: string }[], tips: { professionalId: string }[] = []) {
  if (ctx.session.tenantRole !== "BARBER") return
  check(components.length > 0 && components.every(row => row.professionalId === actor.ownProfessionalId) && tips.every(row => row.professionalId === actor.ownProfessionalId), 403, "Profissional acessa somente seus próprios atendimentos.")
}
