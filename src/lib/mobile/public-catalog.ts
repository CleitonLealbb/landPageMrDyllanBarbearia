import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export type PublicErrorCode =
  | "BARBERSHOP_NOT_FOUND"
  | "INVALID_QUERY"
  | "INTERNAL_ERROR"

export function publicError(
  status: number,
  code: PublicErrorCode,
  message: string
) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export function publicInternalError() {
  return publicError(500, "INTERNAL_ERROR", "Erro interno do servidor.")
}

export async function findActiveBarbershop(slug: string) {
  return prisma.barbershop.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      phone: true,
      timezone: true,
    },
  })
}

export function barbershopNotFound() {
  return publicError(
    404,
    "BARBERSHOP_NOT_FOUND",
    "Barbearia nao encontrada."
  )
}

export function parseServiceIds(request: Request):
  | { serviceIds: string[]; response?: never }
  | { serviceIds?: never; response: NextResponse } {
  const searchParams = new URL(request.url).searchParams
  const invalidKey = [...searchParams.keys()].some((key) => key !== "serviceIds")
  if (invalidKey) {
    return {
      response: publicError(400, "INVALID_QUERY", "Consulta invalida."),
    }
  }

  if (!searchParams.has("serviceIds")) return { serviceIds: [] }

  const values = searchParams
    .getAll("serviceIds")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())

  if (
    values.length === 0 ||
    values.length > 20 ||
    values.some((value) => !value || value.length > 128)
  ) {
    return {
      response: publicError(400, "INVALID_QUERY", "serviceIds invalido."),
    }
  }

  const serviceIds = [...new Set(values)]
  if (serviceIds.length > 20) {
    return {
      response: publicError(400, "INVALID_QUERY", "serviceIds invalido."),
    }
  }

  return { serviceIds }
}
