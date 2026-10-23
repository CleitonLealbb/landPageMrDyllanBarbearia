import { openCash } from "@/lib/checkout/production"
import { post } from "@/lib/checkout/http"
import { openSchema } from "@/lib/checkout/validation"

export const POST = post("checkout:cash", openSchema, openCash)
