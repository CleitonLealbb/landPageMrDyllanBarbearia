import { CategoryStatus, Prisma } from "@prisma/client"
import { isRecord } from "./catalog"

export const adminCategorySelect = { id: true, name: true, description: true, displayOrder: true, status: true, _count: { select: { services: true } } } satisfies Prisma.ServiceCategorySelect
export type CategoryWriteData = { name?: string; description?: string | null; displayOrder?: number; status?: CategoryStatus }
type Result = { value: CategoryWriteData; error?: never } | { value?: never; error: string }

export function validateCategoryBody(body: unknown, partial: boolean): Result {
  if (!isRecord(body)) return { error: "Corpo da requisicao invalido." }
  if (Object.keys(body).some((key) => !["name", "description", "displayOrder", "status"].includes(key))) return { error: "Campo nao permitido." }
  const data: CategoryWriteData = {}
  if (!partial || "name" in body) { if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) return { error: "Nome da categoria invalido." }; data.name = body.name.trim() }
  if ("description" in body) { if (body.description !== null && typeof body.description !== "string") return { error: "Descricao invalida." }; const description = typeof body.description === "string" ? body.description.trim() : null; if (description && description.length > 500) return { error: "Descricao invalida." }; data.description = description || null }
  if ("displayOrder" in body) { if (!Number.isInteger(body.displayOrder) || Number(body.displayOrder) < 0) return { error: "Ordem de exibicao invalida." }; data.displayOrder = Number(body.displayOrder) } else if (!partial) data.displayOrder = 0
  if ("status" in body) { if (body.status !== CategoryStatus.ACTIVE && body.status !== CategoryStatus.INACTIVE) return { error: "Status invalido." }; data.status = body.status } else if (!partial) data.status = CategoryStatus.ACTIVE
  if (partial && Object.keys(data).length === 0) return { error: "Nenhum campo para atualizar." }
  return { value: data }
}
