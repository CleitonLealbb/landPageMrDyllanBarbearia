import { describe, expect, it } from "vitest"

import { isSessionPayload } from "@/lib/auth/claims"
import {
  ownerSession,
  professionalAssistantSession,
  professionalBarberSession,
  superAdminSession,
} from "../../setup/session-fixtures"

describe("isSessionPayload", () => {
  it.each([
    ["SUPER_ADMIN", superAdminSession],
    ["USER owner", ownerSession],
    ["USER BARBER", { ...ownerSession, tenantRole: "BARBER" }],
    ["USER ASSISTANT", { ...ownerSession, tenantRole: "ASSISTANT" }],
    ["PROFESSIONAL BARBER", professionalBarberSession],
    ["PROFESSIONAL ASSISTANT", professionalAssistantSession],
  ])("aceita claims canonicos de %s", (_name, payload) => {
    expect(isSessionPayload(payload)).toBe(true)
  })

  it.each([
    ["null", null],
    ["string", "session"],
    ["array", [superAdminSession]],
    ["tipo desconhecido", { ...ownerSession, type: "SERVICE" }],
    ["role legado", { ...ownerSession, role: "BARBERSHOP_OWNER" }],
    ["versao ausente", (({ sessionVersion: _, ...rest }) => rest)(ownerSession)],
    ["versao string", { ...ownerSession, sessionVersion: "4" }],
    ["versao negativa", { ...ownerSession, sessionVersion: -1 }],
    ["versao decimal", { ...ownerSession, sessionVersion: 1.5 }],
    ["userId vazio", { ...ownerSession, userId: " " }],
    ["professionalId vazio", { ...professionalBarberSession, professionalId: "" }],
    ["barbershopId vazio", { ...ownerSession, barbershopId: "" }],
    ["globalRole desconhecido", { ...ownerSession, globalRole: "ADMIN" }],
    ["tenantRole desconhecido", { ...ownerSession, tenantRole: "MANAGER" }],
    ["SUPER_ADMIN com tenantRole", { ...superAdminSession, tenantRole: "BARBER" }],
    ["SUPER_ADMIN com barbershopId", { ...superAdminSession, barbershopId: "shop" }],
    ["SUPER_ADMIN com professionalId", { ...superAdminSession, professionalId: "pro" }],
    ["USER tenant sem barbershopId", { ...ownerSession, barbershopId: null }],
    ["USER com professionalId", { ...ownerSession, professionalId: "pro" }],
    ["PROFESSIONAL com userId", { ...professionalBarberSession, userId: "user" }],
    ["PROFESSIONAL owner", { ...professionalBarberSession, tenantRole: "BARBERSHOP_OWNER" }],
    ["PROFESSIONAL global", { ...professionalBarberSession, globalRole: "SUPER_ADMIN" }],
  ])("rejeita %s", (_name, payload) => {
    expect(isSessionPayload(payload)).toBe(false)
  })
})
