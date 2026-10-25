import { readSale, saleHistory, editSale } from "@/lib/checkout/production"
import { check } from "@/lib/checkout/errors"
import { getId as get } from "@/lib/checkout/http"
import { postId } from "@/lib/checkout/http"
import { editSaleSchema } from "@/lib/checkout/validation"

export const PATCH = postId("checkout:sales", editSaleSchema, (ctx, key, input, id) => editSale(ctx, key, id, input))

export const GET = get("checkout:sales", (ctx, request, id) => {
  const params = new URL(request.url).searchParams
  check([...params.keys()].every(key => key === "include") && (!params.has("include") || (params.getAll("include").length === 1 && params.get("include") === "history")), 400, "Parâmetro inválido.")
  return params.has("include") ? saleHistory(ctx, id) : readSale(ctx, id)
})
