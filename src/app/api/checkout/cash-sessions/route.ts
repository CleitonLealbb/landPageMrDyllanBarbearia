import { get } from "@/lib/checkout/http"
import { listCashSessions } from "@/lib/checkout/production"

export const GET = get("checkout:cash", (ctx, request) => listCashSessions(ctx, new URL(request.url).searchParams))
