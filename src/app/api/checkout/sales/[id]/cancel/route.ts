import { cancelSale } from "@/lib/checkout/production"
import { postId as post } from "@/lib/checkout/http"
import { cancelSchema } from "@/lib/checkout/validation"

export const POST = post("checkout:cancel", cancelSchema, (ctx, key, input, id) => cancelSale(ctx, key, id, input))
