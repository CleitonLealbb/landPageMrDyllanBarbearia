import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
const schema = readFileSync("prisma/schema.prisma", "utf8")
const sql = readFileSync("prisma/migrations/20260814010000_service_packages/migration.sql", "utf8")
const durationSql = readFileSync("prisma/migrations/20260814020000_service_package_duration/migration.sql", "utf8")
describe("schema e migration de combos", () => {
  it("declara tabelas e campos operacionais", () => { const packageModel=schema.match(/model ServicePackage \{[\s\S]*?\n\}/)?.[0]??""; expect(packageModel).toContain("durationMinutes Int"); for (const field of ["priceCents", "displayOrder", "status"]) expect(packageModel).toContain(field); expect(schema).toMatch(/model ServicePackageItem \{/); expect(sql).toContain('CREATE TABLE "ServicePackage"'); expect(sql).toContain('CREATE TABLE "ServicePackageItem"') })
  it("protege preço e ordens com checks", () => { expect(sql).toContain('CHECK ("priceCents" >= 0)'); expect(sql.match(/CHECK \("displayOrder" >= 0\)/g)).toHaveLength(2) })
  it("mantém unicidade por tenant e nome e por item", () => { expect(sql).toContain('UNIQUE INDEX "ServicePackage_barbershopId_name_key"'); expect(sql).toContain('PRIMARY KEY ("barbershopId", "packageId", "serviceId")') })
  it("usa FKs compostas tenant-safe e restritivas", () => { expect(sql).toContain('FOREIGN KEY ("barbershopId", "packageId")'); expect(sql).toContain('REFERENCES "ServicePackage"("barbershopId", "id") ON DELETE RESTRICT'); expect(sql).toContain('FOREIGN KEY ("barbershopId", "serviceId")'); expect(sql).toContain('REFERENCES "Service"("barbershopId", "id") ON DELETE RESTRICT') })
  it("não contém SQL destrutivo nem cascade de exclusão", () => { expect(sql).not.toMatch(/^\s*(?:DROP|DELETE|TRUNCATE)\b/im); expect(sql).not.toMatch(/ON DELETE CASCADE/i) })
  it("adiciona e preenche duracao persistida antes de torna-la obrigatoria",()=>{expect(durationSql).toContain('ADD COLUMN "durationMinutes" INTEGER');expect(durationSql).toContain('SUM(service."durationMinutes")');expect(durationSql).toContain('ALTER COLUMN "durationMinutes" SET NOT NULL');expect(durationSql).toContain('CHECK ("durationMinutes" > 0)');expect(durationSql).toContain("RAISE EXCEPTION");expect(durationSql).not.toMatch(/^\s*(?:DROP|DELETE|TRUNCATE)\b/im)})
})
