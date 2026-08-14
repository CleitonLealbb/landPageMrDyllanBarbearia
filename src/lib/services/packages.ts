import { Prisma, ServiceStatus } from "@prisma/client"

import { isRecord } from "@/lib/services/catalog"

export const packageServiceSelect = {
  id: true,
  name: true,
  priceCents: true,
  durationMinutes: true,
  status: true,
  category: { select: { id: true, name: true, displayOrder: true } },
} satisfies Prisma.ServiceSelect

export const adminPackageSelect = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  displayOrder: true,
  status: true,
  items: {
    orderBy: { displayOrder: "asc" as const },
    select: { displayOrder: true, service: { select: packageServiceSelect } },
  },
} satisfies Prisma.ServicePackageSelect

export type PackageWithItems = Prisma.ServicePackageGetPayload<{ select: typeof adminPackageSelect }>

export function presentPackage(value: PackageWithItems) {
  const services = value.items.map((item) => item.service)
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    priceCents: value.priceCents,
    originalPriceCents: services.reduce((sum, service) => sum + service.priceCents, 0),
    durationMinutes: services.reduce((sum, service) => sum + service.durationMinutes, 0),
    displayOrder: value.displayOrder,
    status: value.status,
    services,
  }
}

export type PackageWriteData = {
  name?: string
  description?: string | null
  priceCents?: number
  displayOrder?: number
  status?: ServiceStatus
  serviceIds?: string[]
}

export function validatePackageBody(body: unknown, partial: boolean): { value?: PackageWriteData; error?: string } {
  if (!isRecord(body)) return { error: "Corpo da requisicao invalido." }
  const data: PackageWriteData = {}
  if (!partial || "name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) return { error: "Nome do combo invalido." }
    data.name = body.name.trim()
  }
  if ("description" in body) {
    if (body.description !== null && typeof body.description !== "string") return { error: "Descricao invalida." }
    data.description = typeof body.description === "string" ? body.description.trim() || null : null
  }
  if (!partial || "priceCents" in body) {
    if (!Number.isInteger(body.priceCents) || Number(body.priceCents) < 0) return { error: "Preco invalido." }
    data.priceCents = Number(body.priceCents)
  }
  if ("displayOrder" in body) {
    if (!Number.isInteger(body.displayOrder) || Number(body.displayOrder) < 0) return { error: "Ordem invalida." }
    data.displayOrder = Number(body.displayOrder)
  } else if (!partial) data.displayOrder = 0
  if ("status" in body) {
    if (body.status !== ServiceStatus.ACTIVE && body.status !== ServiceStatus.INACTIVE) return { error: "Status invalido." }
    data.status = body.status
  } else if (!partial) data.status = ServiceStatus.ACTIVE
  if (!partial || "serviceIds" in body) {
    if (!Array.isArray(body.serviceIds) || body.serviceIds.some((id) => typeof id !== "string" || !id.trim())) return { error: "Servicos invalidos." }
    data.serviceIds = [...new Set(body.serviceIds.map((id) => id.trim()))]
    if (data.serviceIds.length < 2) return { error: "Selecione ao menos dois servicos distintos." }
  }
  if (partial && Object.keys(data).length === 0) return { error: "Nenhum campo para atualizar." }
  return { value: data }
}

export function packageSavings(originalPriceCents: number, priceCents: number) {
  const cents = Math.max(0, originalPriceCents - priceCents)
  return { cents, percent: originalPriceCents > 0 ? Math.round((cents / originalPriceCents) * 100) : 0 }
}
