import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { bootstrap } from "@/lib/checkout/bootstrap"
import { get } from "@/lib/checkout/http"
import { check } from "@/lib/checkout/errors"

const querySchema = z.string().max(80).transform(value => value.normalize("NFKC").trim().replace(/\s+/g, " ")).refine(value => value.length === 0 || value.length >= 2)
export const GET = get("checkout:sales", async (ctx, request) => {
  const query = new URL(request.url).searchParams
  check([...query.keys()].every(key => key === "customerQuery") && query.getAll("customerQuery").length <= 1, 400, "Parâmetros inválidos.")
  const term = querySchema.parse(query.get("customerQuery") ?? "")
  return { status: 200, body: await bootstrap(prisma, ctx, term) }
})
