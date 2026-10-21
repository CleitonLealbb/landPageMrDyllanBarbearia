import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const schema = readFileSync("prisma/schema.prisma", "utf8")
const migration = readFileSync(
  "prisma/migrations/20260813020000_link_owner_professional_profile/migration.sql",
  "utf8"
)

describe("vinculo tenant-safe entre owner e Professional", () => {
  it("mantem userId nullable com unique e FK compostas", () => {
    expect(schema).toContain("userId          String?")
    expect(schema).toContain("@@unique([barbershopId, userId])")
    expect(schema).toContain("fields: [barbershopId, userId], references: [barbershopId, userId]")
  })

  it("usa migration somente estrutural e nao destrutiva", () => {
    expect(migration).toContain('ADD COLUMN "userId" TEXT')
    expect(migration).toContain('FOREIGN KEY ("barbershopId", "userId")')
    expect(migration).not.toMatch(/^\s*(?:DROP|TRUNCATE|DELETE|INSERT)\b/im)
  })
})
