import { NextResponse } from "next/server"

import {
  barbershopNotFound,
  findActiveBarbershop,
  publicInternalError,
} from "@/lib/mobile/public-catalog"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params
    const barbershop = await findActiveBarbershop(slug)
    if (!barbershop) return barbershopNotFound()
    return NextResponse.json(barbershop)
  } catch {
    return publicInternalError()
  }
}
