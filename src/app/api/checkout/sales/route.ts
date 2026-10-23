import { createSale } from "@/lib/checkout/production"
import { post } from "@/lib/checkout/http"
import { createSaleSchema } from "@/lib/checkout/validation"

export const POST = post("checkout:sales", createSaleSchema, createSale)
