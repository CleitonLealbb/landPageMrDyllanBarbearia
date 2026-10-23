import { moveCash } from "@/lib/checkout/production"
import { post } from "@/lib/checkout/http"
import { movementSchema } from "@/lib/checkout/validation"

export const POST = post("checkout:cash", movementSchema, moveCash)
