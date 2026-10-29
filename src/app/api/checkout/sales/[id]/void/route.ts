import { voidSale } from "@/lib/checkout/production"
import { postId } from "@/lib/checkout/http"
import { voidSchema } from "@/lib/checkout/validation"

export const POST = postId("checkout:sales", voidSchema, (ctx, key, input, id) => voidSale(ctx, key, id, input))
