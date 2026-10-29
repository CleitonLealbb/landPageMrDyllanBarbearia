import { closeCash } from "@/lib/checkout/production"
import { postId as post } from "@/lib/checkout/http"
import { closeSchema } from "@/lib/checkout/validation"

export const POST = post("checkout:cash", closeSchema, (ctx, key, input, id) => closeCash(ctx, key, id, input))
