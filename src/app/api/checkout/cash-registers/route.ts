import { get, post } from "@/lib/checkout/http"
import { createRegister, listRegisters } from "@/lib/checkout/production"
import { createRegisterSchema } from "@/lib/checkout/registers"

export const GET = get("checkout:registers", ctx => listRegisters(ctx))
export const POST = post("checkout:registers", createRegisterSchema, createRegister)
