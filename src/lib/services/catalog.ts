import { Prisma, ServiceStatus } from "@prisma/client"
import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

export const adminServiceSelect = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  durationMinutes: true,
  displayOrder: true,
  status: true,
  category: { select: { id: true, name: true, status: true, displayOrder: true } },
  professionals: {
    select: {
      professional: {
        select: { id: true, name: true, role: true, photoUrl: true },
      },
    },
  },
} satisfies Prisma.ServiceSelect

export type CatalogOwner = { userId: string; barbershopId: string }

export async function requireCatalogOwner(): Promise<
  | { owner: CatalogOwner; response?: never }
  | { owner?: never; response: NextResponse }
> {
  const session = await getSession()

  if (!session) {
    return {
      response: NextResponse.json({ message: "Nao autenticado." }, { status: 401 }),
    }
  }

  if (
    session.type !== "USER" ||
    session.globalRole !== null ||
    session.tenantRole !== "BARBERSHOP_OWNER"
  ) {
    return {
      response: NextResponse.json({ message: "Acesso negado." }, { status: 403 }),
    }
  }

  const membership = await prisma.barbershopUser.findFirst({
    where: {
      userId: session.userId,
      barbershopId: session.barbershopId,
      role: "BARBERSHOP_OWNER",
      barbershop: { status: "ACTIVE" },
    },
    select: { id: true },
  })

  if (!membership) {
    return {
      response: NextResponse.json({ message: "Acesso negado." }, { status: 403 }),
    }
  }

  return {
    owner: { userId: session.userId, barbershopId: session.barbershopId },
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isPrismaUniqueError(error: unknown) {
  return isRecord(error) && error.code === "P2002"
}

export function internalErrorResponse() {
  return NextResponse.json(
    { message: "Erro interno do servidor." },
    { status: 500 }
  )
}

export type ServiceWriteData = {
  name?: string
  description?: string | null
  priceCents?: number
  durationMinutes?: number
  displayOrder?: number
  status?: ServiceStatus
  categoryId?: string | null
}

type ValidationResult<T> =
  | { value: T; error?: never }
  | { value?: never; error: string }

const serviceFields = new Set([
  "name",
  "description",
  "priceCents",
  "durationMinutes",
  "displayOrder",
  "status",
  "categoryId",
])

export function validateServiceBody(
  body: unknown,
  partial: boolean
): ValidationResult<ServiceWriteData> {
  if (!isRecord(body)) return { error: "Corpo da requisicao invalido." }

  const unexpected = Object.keys(body).filter((key) => !serviceFields.has(key))
  if (unexpected.length > 0) return { error: "Campo nao permitido." }

  const data: ServiceWriteData = {}

  if (!partial || "name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return { error: "Nome do servico invalido." }
    }
    data.name = body.name.trim()
  }

  if ("description" in body) {
    if (body.description !== null && typeof body.description !== "string") {
      return { error: "Descricao invalida." }
    }
    data.description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null
  }

  if (!partial || "priceCents" in body) {
    if (!Number.isInteger(body.priceCents) || Number(body.priceCents) < 0) {
      return { error: "Preco invalido." }
    }
    data.priceCents = Number(body.priceCents)
  }

  if (!partial || "durationMinutes" in body) {
    if (!Number.isInteger(body.durationMinutes) || Number(body.durationMinutes) <= 0) {
      return { error: "Duracao invalida." }
    }
    data.durationMinutes = Number(body.durationMinutes)
  }

  if ("displayOrder" in body) {
    if (!Number.isInteger(body.displayOrder) || Number(body.displayOrder) < 0) {
      return { error: "Ordem de exibicao invalida." }
    }
    data.displayOrder = Number(body.displayOrder)
  } else if (!partial) {
    data.displayOrder = 0
  }

  if ("status" in body) {
    if (body.status !== ServiceStatus.ACTIVE && body.status !== ServiceStatus.INACTIVE) {
      return { error: "Status invalido." }
    }
    data.status = body.status
  } else if (!partial) {
    data.status = ServiceStatus.ACTIVE
  }

  if ("categoryId" in body) {
    if (body.categoryId !== null && (typeof body.categoryId !== "string" || !body.categoryId.trim())) return { error: "Categoria invalida." }
    data.categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : null
  }

  if (partial && Object.keys(data).length === 0) {
    return { error: "Nenhum campo para atualizar." }
  }

  return { value: data }
}

export function validateProfessionalIds(
  value: unknown
): ValidationResult<string[]> {
  if (!Array.isArray(value)) return { error: "professionalIds invalido." }

  if (value.some((id) => typeof id !== "string" || !id.trim())) {
    return { error: "professionalIds invalido." }
  }

  return { value: [...new Set(value.map((id) => id.trim()))] }
}
