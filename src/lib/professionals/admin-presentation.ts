import type { Prisma } from "@prisma/client"

export const adminProfessionalSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  permissionLevel: true,
  commission: true,
  specialties: true,
  photoUrl: true,
  status: true,
  membership: {
    select: {
      user: { select: { email: true } },
    },
  },
} satisfies Prisma.ProfessionalSelect

type SelectedProfessional = Prisma.ProfessionalGetPayload<{
  select: typeof adminProfessionalSelect
}>

export function presentAdminProfessional(professional: SelectedProfessional) {
  const { membership, ...publicProfessional } = professional
  const linked = membership != null

  return {
    ...publicProfessional,
    accessEmail: linked ? membership.user.email : professional.email,
    identityType: linked
      ? ("LINKED_USER" as const)
      : ("INDEPENDENT_PROFESSIONAL" as const),
  }
}
