import { currentCash } from "@/lib/checkout/production"
import { get } from "@/lib/checkout/http"
import { identifier } from "@/lib/checkout/validation"
import { check } from "@/lib/checkout/errors"

export const GET = get("checkout:cash", (ctx, request) => {
  const query = new URL(request.url).searchParams
  check([...query.keys()].length === 1 && query.has("cashRegisterId"), 400, "Informe somente cashRegisterId.")
  return currentCash(ctx, identifier.parse(query.get("cashRegisterId")))
})
