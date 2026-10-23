import { z } from "zod"

export const MAX_CENTS = 2147483647
export const identifier = z.string().trim().min(1).max(100)
const cents = z.number().int().min(0).max(MAX_CENTS)
const positive = cents.min(1)
const quantity = z.number().int().min(1).max(100)
export const idempotencyKey = z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/)
export const openSchema = z.object({ cashRegisterId: identifier, shift: z.string().trim().min(1).max(80), openingBalanceCents: cents }).strict()
export const closeSchema = z.object({ countedBalanceCents: cents, notes: z.string().trim().max(1000).optional() }).strict()
export const movementSchema = z.object({ cashSessionId: identifier, kind: z.enum(["SUPPLY", "WITHDRAWAL"]), amountCents: positive, reason: z.string().trim().min(1).max(500) }).strict()
const serviceItem = z.object({ kind: z.literal("SERVICE"), catalogId: identifier, quantity, professionalId: identifier }).strict()
const productItem = z.object({ kind: z.literal("PRODUCT"), catalogId: identifier, quantity }).strict()
const packageItem = z.object({ kind: z.literal("PACKAGE"), catalogId: identifier, quantity, components: z.array(z.object({ serviceId: identifier, professionalId: identifier }).strict()).min(2).max(50) }).strict()
export const discountSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("FIXED"), amountCents: cents }).strict(),
  z.object({ kind: z.literal("PERCENT"), basisPoints: z.number().int().min(0).max(10000) }).strict(),
])
export const createSaleSchema = z.object({
  customerId: identifier.optional(),
  items: z.array(z.discriminatedUnion("kind", [serviceItem, productItem, packageItem])).min(1).max(100),
  discount: discountSchema.optional(),
  tips: z.array(z.object({ professionalId: identifier, amountCents: positive }).strict()).max(50).default([]),
}).strict().superRefine((input, ctx) => {
  const count = input.items.reduce((sum, item) => sum + item.quantity * (item.kind === "PACKAGE" ? item.components.length : 1), 0)
  if (count > 1000) ctx.addIssue({ code: "custom", message: "Comanda excede o limite de componentes." })
  if (new Set(input.tips.map(tip => tip.professionalId)).size !== input.tips.length) ctx.addIssue({ code: "custom", message: "Gorjeta duplicada." })
})
export const paymentSchema = z.object({ method: z.enum(["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD"]), appliedCents: positive, cashReceivedCents: positive.optional(), confirmed: z.literal(true) }).strict()
export const finalizeSchema = z.object({ cashSessionId: identifier, expectedVersion: z.number().int().min(0).max(MAX_CENTS), payments: z.array(paymentSchema).max(20) }).strict()
export const cancelSchema = z.object({ cashSessionId: identifier.optional(), reason: z.string().trim().min(1).max(500) }).strict()
export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type FinalizeInput = z.infer<typeof finalizeSchema>
export type CancelInput = z.infer<typeof cancelSchema>
