import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const schema = readFileSync("prisma/schema.prisma", "utf8")
const migration = readFileSync(
  "prisma/migrations/20260806222509_mobile_customer_catalog_foundation/migration.sql",
  "utf8"
)

describe("mobile customer catalog foundation", () => {
  it("mantem clientes separados das identidades administrativas", () => {
    expect(schema).toContain("model CustomerAccount")
    expect(schema).toContain("passwordHash   String")
    expect(schema).not.toMatch(/model CustomerAccount[\s\S]*?\brole\s+/)
  })

  it("isola os vinculos de profissional e servico pelo tenant", () => {
    expect(schema).toContain("@@id([barbershopId, professionalId, serviceId])")
    expect(schema).toContain(
      "@relation(fields: [barbershopId, professionalId], references: [barbershopId, id])"
    )
    expect(schema).toContain(
      "@relation(fields: [barbershopId, serviceId], references: [barbershopId, id])"
    )
  })

  it("faz somente o backfill permitido e nao contem DDL destrutivo", () => {
    expect(migration.match(/^UPDATE\s+"Barbershop"/gim)).toHaveLength(1)
    expect(migration).toContain('"slug" = \'mr-dyllan-barbearia\'')
    expect(migration).toContain('"timezone" = \'America/Cuiaba\'')
    expect(migration).not.toMatch(/^\s*(DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM)\b/gim)
    expect(migration).not.toMatch(/^\s*(ALTER|UPDATE)\s+TABLE?\s+"User"/gim)
  })
})
