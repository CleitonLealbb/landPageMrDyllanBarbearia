import { createSale, listSales } from "@/lib/checkout/production"
import { get } from "@/lib/checkout/http"
import { post } from "@/lib/checkout/http"
import { createSaleSchema } from "@/lib/checkout/validation"

export const POST = post("checkout:sales", createSaleSchema, createSale)
export const GET = get("checkout:sales", (ctx, request) => listSales(ctx, new URL(request.url).searchParams))
