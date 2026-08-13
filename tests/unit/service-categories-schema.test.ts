import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
const schema = readFileSync("prisma/schema.prisma", "utf8")
const migration = readFileSync("prisma/migrations/20260813010000_service_categories/migration.sql", "utf8")
describe("service categories schema", () => {
  it("mantem categoria opcional e FK composta por tenant", () => { expect(schema).toMatch(/categoryId\s+String\?/); expect(schema).toMatch(/references: \[barbershopId, id\]/); expect(schema).toMatch(/@@unique\(\[barbershopId, id\]\)/) })
  it("inclui constraints sem SQL destrutivo", () => { expect(migration).toContain('CHECK ("displayOrder" >= 0)'); expect(migration).toContain('FOREIGN KEY ("barbershopId", "categoryId")'); expect(migration).not.toMatch(/^\s*(?:DROP|TRUNCATE|DELETE)\b/im) })
})
