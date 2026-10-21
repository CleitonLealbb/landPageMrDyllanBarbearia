import type { Session } from "@/lib/auth/claims"

export const superAdminSession = {
  type: "USER",
  userId: "user-super-admin",
  globalRole: "SUPER_ADMIN",
  tenantRole: null,
  barbershopId: null,
  sessionVersion: 3,
} satisfies Session

export const ownerSession = {
  type: "USER",
  userId: "user-owner",
  globalRole: null,
  tenantRole: "BARBERSHOP_OWNER",
  barbershopId: "barbershop-one",
  sessionVersion: 4,
} satisfies Session

export const professionalBarberSession = {
  type: "PROFESSIONAL",
  professionalId: "professional-barber",
  globalRole: null,
  tenantRole: "BARBER",
  barbershopId: "barbershop-one",
  sessionVersion: 5,
} satisfies Session

export const professionalAssistantSession = {
  ...professionalBarberSession,
  professionalId: "professional-assistant",
  tenantRole: "ASSISTANT",
} satisfies Session
