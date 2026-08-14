import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
const schema = readFileSync("prisma/schema.prisma", "utf8")
const sql = readFileSync("prisma/migrations/20260814010000_service_packages/migration.sql", "utf8")
describe("schema e migration de combos", () => {
  it("declara tabelas e campos operacionais", () => { expect(schema).toMatch(/model ServicePackage \{/); expect(schema).toMatch(/model ServicePackageItem \{/); for (const field of ["priceCents", "displayOrder", "status", "packageId", "serviceId"]) expect(schema).toContain(field); expect(sql).toContain('CREATE TABLE "ServicePackage"'); expect(sql).toContain('CREATE TABLE "ServicePackageItem"') })
  it("protege preço e ordens com checks", () => { expect(sql).toContain('CHECK ("priceCents" >= 0)'); expect(sql.match(/CHECK \("displayOrder" >= 0\)/g)).toHaveLength(2) })
  it("mantém unicidade por tenant e nome e por item", () => { expect(sql).toContain('UNIQUE INDEX "ServicePackage_barbershopId_name_key"'); expect(sql).toContain('PRIMARY KEY ("barbershopId", "packageId", "serviceId")') })
  it("usa FKs compostas tenant-safe e restritivas", () => { expect(sql).toContain('FOREIGN KEY ("barbershopId", "packageId")'); expect(sql).toContain('REFERENCES "ServicePackage"("barbershopId", "id") ON DELETE RESTRICT'); expect(sql).toContain('FOREIGN KEY ("barbershopId", "serviceId")'); expect(sql).toContain('REFERENCES "Service"("barbershopId", "id") ON DELETE RESTRICT') })
  it("não contém SQL destrutivo nem cascade de exclusão", () => { expect(sql).not.toMatch(/^\s*(?:DROP|DELETE|TRUNCATE)\b/im); expect(sql).not.toMatch(/ON DELETE CASCADE/i) })
})
