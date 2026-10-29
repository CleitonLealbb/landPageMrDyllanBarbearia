import { getId } from "@/lib/checkout/http"
import { cashHistory } from "@/lib/checkout/production"

export const GET = getId("checkout:cash", (ctx, request, id) => cashHistory(ctx, id, new URL(request.url).searchParams))
