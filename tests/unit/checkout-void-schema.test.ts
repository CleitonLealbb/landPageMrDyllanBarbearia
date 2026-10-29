import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

const enumMigration = "20261024160000_checkout_sale_voided_enum"
const guardsMigration = "20261024160100_checkout_sale_voided_guards"
const enumSql = readFileSync(`prisma/migrations/${enumMigration}/migration.sql`, "utf8")
const guardsSql = readFileSync(`prisma/migrations/${guardsMigration}/migration.sql`, "utf8")
const schema = readFileSync("prisma/schema.prisma", "utf8")
const foundation = readFileSync("prisma/migrations/20261022120000_checkout_pdv_foundation/migration.sql", "utf8")
const duration = readFileSync("prisma/migrations/20261022130000_checkout_duration_snapshots/migration.sql", "utf8")
const functions = new Map([...guardsSql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION "([^"]+)"\(\) RETURNS trigger LANGUAGE plpgsql AS \$\$([\s\S]*?)\$\$;/g)].map(match => [match[1], match[2]]))
const saleGuard = functions.get("checkout_guard_sale")!
const financialGuard = functions.get("checkout_guard_sale_financial_effect")!
const model = (name: string) => Prisma.dmmf.datamodel.models.find(value => value.name === name)!

describe("Checkout: descarte aditivo em duas migrations", () => {
  it("adiciona o enum sozinho e somente o utiliza na migration posterior", () => {
    expect(enumSql.trim()).toBe('ALTER TYPE "SaleStatus" ADD VALUE \'VOIDED\';')
    expect(enumMigration < guardsMigration).toBe(true)
    expect(guardsSql).not.toMatch(/ALTER TYPE/)
    expect(guardsSql.trim().startsWith("BEGIN;")).toBe(true)
    expect(guardsSql.trim().endsWith("COMMIT;")).toBe(true)
    expect(Prisma.dmmf.datamodel.enums.find(value => value.name === "SaleStatus")!.values.map(value => value.name)).toEqual(["DRAFT", "PENDING", "PAID", "CANCELED", "VOIDED"])
  })

  it("preserva integralmente a migration da fundação e os snapshots de duração", () => {
    expect(createHash("sha256").update(foundation.replace(/\r\n/g, "\n")).digest("hex")).toBe("b40706bafc64c50961fbc3145aa4cb871638e1c5dd0039ed3db7c415aad8a38f")
    expect(duration).toContain('ALTER TABLE "SaleItem" ADD COLUMN "durationMinutesSnapshot" INTEGER;')
    expect(duration).toContain('ALTER TABLE "SaleServiceComponent" ADD COLUMN "durationMinutesSnapshot" INTEGER;')
    expect(guardsSql).not.toMatch(/DROP|TRUNCATE|ON DELETE CASCADE/)
    expect(guardsSql).not.toMatch(/^\s*(?:DELETE|INSERT)\s+"/m)
    // The only UPDATE statements belong to runtime trigger functions, not a
    // migration backfill. They preserve every stored column value.
    expect(guardsSql.match(/UPDATE "Sale" SET "version" = "version"/g)).toHaveLength(2)
    expect(guardsSql.replace(/CREATE (?:OR REPLACE )?FUNCTION[\s\S]*?\$\$;/g, "")).not.toMatch(/^\s*UPDATE\s/m)
    expect(guardsSql).not.toContain('DROP CONSTRAINT "Sale_lifecycle_check"')
  })

  it.each([["voidedAt", "DateTime", "TIMESTAMP(3)"], ["voidedById", "String", "TEXT"], ["voidReason", "String", "TEXT"]])("representa %s como coluna nullable sem backfill", (name, type, sqlType) => {
    expect(model("Sale").fields.find(value => value.name === name)).toMatchObject({ type, isRequired: false })
    expect(guardsSql).toContain(`ALTER TABLE "Sale" ADD COLUMN "${name}" ${sqlType};`)
  })

  it("mantém autoria tenant-safe e índices equivalentes ao schema", () => {
    expect(model("Sale").fields.find(value => value.name === "voidedBy")).toMatchObject({
      type: "CheckoutActor", isRequired: false,
      relationFromFields: ["barbershopId", "voidedById"], relationToFields: ["barbershopId", "id"], relationOnDelete: "Restrict",
    })
    expect(guardsSql).toContain('FOREIGN KEY ("barbershopId", "voidedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;')
    expect(schema).toContain("@@index([barbershopId, status, voidedAt])")
    expect(schema).toContain("@@index([barbershopId, voidedById])")
    expect(guardsSql).toContain('ON "Sale"("barbershopId", "status", "voidedAt")')
    expect(guardsSql).toContain('ON "Sale"("barbershopId", "voidedById")')
  })

  it("exige motivo normalizado, data e autor somente em VOIDED sem metadados financeiros", () => {
    const check = guardsSql.match(/ADD CONSTRAINT "Sale_void_lifecycle_check" CHECK \(([\s\S]*?)\n\);/)![1]
    expect(check).toContain('"status" = \'VOIDED\' AND "voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND "voidReason" IS NOT NULL')
    expect(check).toContain('"voidedAt" >= "createdAt"')
    expect(check).toContain('length("voidReason") BETWEEN 1 AND 500')
    expect(check).toContain('"voidReason" = btrim(regexp_replace("voidReason", \'[[:space:]]+\', \' \', \'g\'))')
    expect(check).toContain('"finalizedAt" IS NULL AND "canceledAt" IS NULL AND "canceledById" IS NULL AND "cancellationReason" IS NULL')
    expect(check).toContain('"status" <> \'VOIDED\' AND "voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL')
  })

  it("preserva CANCELED legado sem exigir backfill ou nova validação destrutiva", () => {
    expect(foundation).toContain('"canceledAt" >= COALESCE("finalizedAt", "createdAt")')
    // A new cross-row CHECK requiring finalizedAt in every CANCELED row would
    // reject historical discarded orders while adding the constraint.
    expect(guardsSql).not.toMatch(/ADD CONSTRAINT[^;]*"status"\s*=\s*'CANCELED'/)
    expect(saleGuard).toContain('OLD."status" IN (\'CANCELED\', \'VOIDED\')')
    expect(saleGuard).toContain('OLD."status" <> \'PAID\' OR OLD."finalizedAt" IS NULL')
  })
})

describe("Checkout: transições e imutabilidade SQL", () => {
  it("permite explicitamente apenas PENDING→PAID/VOIDED e PAID→CANCELED", () => {
    const transition = saleGuard.match(/IF NEW\."status" IS DISTINCT FROM OLD\."status" AND NOT \(([\s\S]*?)\n    \) THEN/)![1]
    expect(transition.trim()).toBe('(OLD."status" = \'PENDING\' AND NEW."status" IN (\'PAID\', \'VOIDED\'))\n      OR (OLD."status" = \'PAID\' AND NEW."status" = \'CANCELED\')')
    expect(saleGuard).toContain('NEW."status" NOT IN (\'DRAFT\', \'PENDING\') OR NEW."finalizedAt" IS NOT NULL')
    expect(saleGuard).toContain('OLD."status" IN (\'CANCELED\', \'VOIDED\')')
  })

  it("preserva snapshots da finalização e do descarte por comparação da linha inteira", () => {
    expect(saleGuard).toContain("to_jsonb(NEW) - ARRAY['status','canceledAt','canceledById','cancellationReason','version','updatedAt']")
    expect(saleGuard).toContain("to_jsonb(OLD) - ARRAY['status','canceledAt','canceledById','cancellationReason','version','updatedAt']")
    expect(saleGuard).toContain("to_jsonb(NEW) - ARRAY['status','voidedAt','voidedById','voidReason','version','updatedAt']")
    expect(saleGuard).toContain("to_jsonb(OLD) - ARRAY['status','voidedAt','voidedById','voidReason','version','updatedAt']")
  })

  it.each(["checkout_guard_item_snapshot", "checkout_guard_component_snapshot"])("%s congela itens, componentes, duração e gorjetas após descarte", name => {
    expect(functions.get(name)).toContain('parent."status" NOT IN (\'DRAFT\', \'PENDING\')')
    expect(functions.get(name)).toContain('parent."finalizedAt" IS NOT NULL')
    expect(functions.get(name)).toContain("FOR UPDATE")
    expect(functions.get(name)).not.toContain('NEW."durationMinutesSnapshot"')
    // Original triggers still call the replaced functions: no interval without
    // snapshot protection and no trigger deletion is needed.
    expect(foundation).toContain(`EXECUTE FUNCTION "${name}"();`)
  })

  it("valida ausência de efeitos nas quatro fontes, mantendo tips apenas como snapshots históricos", () => {
    const voidBranch = saleGuard.slice(saleGuard.indexOf('IF NEW."status" = \'VOIDED\' THEN'), saleGuard.indexOf('IF NEW."status" = \'PAID\' THEN'))
    for (const table of ["Payment", "CashMovement", "InventoryMovement", "CommissionEntry"]) expect(voidBranch).toContain(`FROM "${table}"`)
    expect(voidBranch).toContain('item."barbershopId" = NEW."barbershopId" AND item."saleId" = NEW."id"')
    expect(voidBranch).not.toMatch(/^\s*(?:UPDATE|INSERT INTO|DELETE FROM)\s+"/m)
    expect(voidBranch).not.toContain('"InventoryBalance"')
    expect(voidBranch).not.toContain('FROM "SaleTip"')
  })
})

describe("Checkout: efeitos financeiros e ordem transacional", () => {
  it.each(["InventoryMovement", "CommissionEntry", "CashMovement"])("trava a venda antes de inserir em %s e rejeita VOIDED", name => {
    expect(guardsSql).toContain(`CREATE TRIGGER "${name}_guard_sale_lifecycle" BEFORE INSERT ON "${name}" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_sale_financial_effect"();`)
    expect(financialGuard).toContain('WHERE "barbershopId" = NEW."barbershopId" AND "id" = parent_id FOR UPDATE')
    expect(financialGuard).toContain('parent."status" IN (\'DRAFT\', \'VOIDED\')')
    expect(financialGuard).toContain(`TG_TABLE_NAME = '${name}'`)
  })

  it("usa vínculos compostos reais para resolver estoque e comissão até a venda", () => {
    expect(financialGuard).toContain('SELECT "saleId" INTO parent_id FROM "SaleItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleItemId"')
    expect(financialGuard).toContain('item."barbershopId" = component."barbershopId" AND item."id" = component."saleItemId"')
    expect(financialGuard).toContain('component."barbershopId" = NEW."barbershopId" AND component."id" = NEW."componentId"')
  })

  it("mantém a ordem caixa→venda e a finalização PENDING→lançamentos→PAID→comissão", () => {
    const cashBranch = financialGuard.slice(financialGuard.indexOf("ELSIF TG_TABLE_NAME = 'CashMovement'"))
    expect(cashBranch.indexOf('FROM "CashSession"')).toBeLessThan(cashBranch.indexOf('FROM "Sale"'))
    expect(cashBranch).toContain('"id" = NEW."cashSessionId" FOR UPDATE')
    expect(financialGuard).toContain('parent."status" <> \'PENDING\' OR parent."finalizedAt" IS NOT NULL')
    expect(financialGuard).toContain('NEW."kind" <> \'EARNED\' OR parent."status" <> \'PAID\' OR parent."finalizedAt" IS NULL')
    expect(functions.get("checkout_guard_payment")).toContain('parent."status" <> \'PENDING\'')
  })

  it("preserva reversões legítimas somente depois de cancelar uma venda paga", () => {
    expect(financialGuard).toContain('IF NEW."kind" = \'REVERSAL\' THEN')
    expect(financialGuard).toContain('parent."status" <> \'CANCELED\' OR parent."finalizedAt" IS NULL')
    expect(functions.get("checkout_guard_payment")).toContain('TG_OP = \'UPDATE\' AND (parent."status" <> \'CANCELED\' OR parent."finalizedAt" IS NULL)')
    for (const table of ["InventoryMovement", "CommissionEntry", "CashMovement"]) expect(foundation).toContain(`CREATE UNIQUE INDEX "${table}_barbershopId_reversalOfId_key"`)
  })

  it("cria versão MVCC do pai sem alterar expectedVersion para escritores de isolamento misto", () => {
    const paymentGuard = functions.get("checkout_guard_payment")!
    const paymentTouch = paymentGuard.indexOf('UPDATE "Sale" SET "version" = "version"')
    const ledgerTouch = financialGuard.indexOf('UPDATE "Sale" SET "version" = "version"')
    // Merely locking a row does not change its visible MVCC version. A raw
    // READ COMMITTED ledger writer must invalidate an earlier Serializable
    // void snapshot too, rather than relying solely on SSI between services.
    expect(paymentGuard.indexOf('FROM "Sale"')).toBeLessThan(paymentTouch)
    expect(paymentGuard.slice(0, paymentTouch)).toContain("IF TG_OP = 'INSERT' THEN")
    expect(paymentGuard.slice(paymentTouch)).toContain('"barbershopId" = NEW."barbershopId" AND "id" = NEW."saleId" AND "status" = \'PENDING\'')
    expect(financialGuard.indexOf('FROM "Sale"')).toBeLessThan(ledgerTouch)
    expect(financialGuard.slice(0, ledgerTouch)).toContain('IF parent."status" = \'PENDING\' THEN')
    expect(financialGuard.slice(ledgerTouch)).toContain('"barbershopId" = NEW."barbershopId" AND "id" = parent_id AND "status" = \'PENDING\'')
    expect(guardsSql).not.toMatch(/SET\s+"(?:updatedAt|totalCents|version)"\s*=\s*(?:now\(|"version"\s*\+)/)
    // The nested no-op UPDATE is accepted while the sale remains PENDING; it
    // cannot recurse into ledger creation or acquire cash/product locks.
    expect(saleGuard).toContain('IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (')
    expect(saleGuard).not.toContain('SET "version"')
  })

  it("não recria tabelas nem remove guards existentes e declara nomes novos sem colisão", () => {
    expect(guardsSql).not.toMatch(/CREATE TABLE|DROP TRIGGER|DROP FUNCTION|DROP CONSTRAINT/)
    const newNames = [...guardsSql.matchAll(/(?:ADD CONSTRAINT|CREATE INDEX|CREATE TRIGGER) "([^"]+)"/g)].map(value => value[1])
    expect(new Set(newNames).size).toBe(newNames.length)
    for (const name of newNames) expect(foundation).not.toContain(`"${name}"`)
    expect([...functions.keys()]).toHaveLength(5)
  })
})
