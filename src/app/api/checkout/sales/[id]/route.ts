import { readSale } from "@/lib/checkout/production"
import { getId as get } from "@/lib/checkout/http"

export const GET = get("checkout:sales", (ctx, _request, id) => readSale(ctx, id))
