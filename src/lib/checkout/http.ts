import { NextResponse } from "next/server"
import type { z } from "zod"
import type { CheckoutPermission, Context } from "./authorization"
import { authorize } from "./session"
import { check, errorResponse } from "./errors"
import { identifier, idempotencyKey } from "./validation"

type Result = { status: number; body: unknown }
type RouteContext = { params: Promise<{ id: string }> }
export function post<T extends z.ZodType>(permission: CheckoutPermission, schema: T, work: (ctx: Context, key: string, input: z.output<T>, id: string) => Promise<Result>) {
  return async (request: Request) => {
    try {
      const ctx = await authorize(permission)
      const key = idempotencyKey.parse(request.headers.get("Idempotency-Key"))
      check(Number(request.headers.get("content-length") ?? 0) <= 65536, 413, "Corpo da requisição muito grande.")
      const text = await request.text()
      check(new TextEncoder().encode(text).length <= 65536, 413, "Corpo da requisição muito grande.")
      const input = schema.parse(JSON.parse(text))
      const result = await work(ctx, key, input, "")
      return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } })
    } catch (error) { return errorResponse(error) }
  }
}
export function get(permission: CheckoutPermission, work: (ctx: Context, request: Request, id: string) => Promise<Result>) {
  return async (request: Request) => {
    try {
      const ctx = await authorize(permission)
      const result = await work(ctx, request, "")
      return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } })
    } catch (error) { return errorResponse(error) }
  }
}
export function postId<T extends z.ZodType>(permission: CheckoutPermission, schema: T, work: (ctx: Context, key: string, input: z.output<T>, id: string) => Promise<Result>) {
  return (request: Request, route: RouteContext) => post(permission, schema, async (ctx, key, input) => work(ctx, key, input, identifier.parse((await route.params).id)))(request)
}
export function getId(permission: CheckoutPermission, work: (ctx: Context, request: Request, id: string) => Promise<Result>) {
  return (request: Request, route: RouteContext) => get(permission, async (ctx, request) => work(ctx, request, identifier.parse((await route.params).id)))(request)
}
