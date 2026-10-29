import { postId } from "@/lib/checkout/http"
import { updateRegister } from "@/lib/checkout/production"
import { updateRegisterSchema } from "@/lib/checkout/registers"

export const PATCH = postId("checkout:registers", updateRegisterSchema, (ctx, key, input, id) => updateRegister(ctx, key, id, input))
