import { finalizeSale } from "@/lib/checkout/production"
import { postId as post } from "@/lib/checkout/http"
import { finalizeSchema } from "@/lib/checkout/validation"

export const POST = post("checkout:sales", finalizeSchema, (ctx, key, input, id) => finalizeSale(ctx, key, id, input))
