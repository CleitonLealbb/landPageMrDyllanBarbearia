import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { saleSelect } from "@/lib/checkout/presentation"

const sql = readFileSync("prisma/migrations/20261024170000_checkout_pending_snapshots/migration.sql", "utf8")
const schema = readFileSync("prisma/schema.prisma", "utf8")
const source = (name: string) => readFileSync(name, "utf8")

describe("Edição PENDING: guards SQL e consumidores de snapshots ativos (inspeção estática)", () => {
  it.each(["SaleItem", "SaleTip"])("%s preserva legado ativo e exige autor tenant-safe", table => {
    for (const [column, type] of [["removedAt", "TIMESTAMP(3)"], ["removedById", "TEXT"], ["removedReason", "TEXT"]]) expect(sql).toContain(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type};`)
    expect(sql).toContain(`CONSTRAINT "${table}_barbershopId_removedById_fkey" FOREIGN KEY ("barbershopId", "removedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT`)
    expect(sql).toContain(`CONSTRAINT "${table}_removal_check"`)
    expect(schema).toContain(`@relation("${table}_removedBy", fields: [barbershopId, removedById], references: [barbershopId, id]`)
  })
  it("troca somente a unicidade de gorjetas, sem apagar dados nem desativar triggers", () => {
    expect(sql).toContain('CREATE UNIQUE INDEX "SaleTip_one_active_professional" ON "SaleTip"("barbershopId", "saleId", "professionalId") WHERE "removedAt" IS NULL')
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP\s+(?:TABLE|TRIGGER|FUNCTION)\b|DISABLE\s+TRIGGER|\bCASCADE\b/i)
    expect(sql.match(/DROP INDEX/g)).toHaveLength(1)
    expect(sql).toMatch(/^BEGIN;/); expect(sql.trim()).toMatch(/COMMIT;$/)
  })
  it("bloqueia reativação, mutação dos snapshots retirados e exclusão física", () => {
    expect(sql).toContain('OLD."removedAt" IS NOT NULL OR NEW."removedAt" IS NULL')
    expect(sql).toContain("to_jsonb(NEW) - ARRAY['removedAt','removedById','removedReason']")
    const foundation = source("prisma/migrations/20261022120000_checkout_pdv_foundation/migration.sql")
    for (const table of ["Sale", "SaleItem", "SaleServiceComponent", "SaleTip"]) expect(foundation).toContain(`CREATE TRIGGER "${table}_no_delete" BEFORE DELETE`)
  })
  it("snapshots encerrados permanecem congelados e apenas PENDING pode retirar", () => {
    expect(sql.match(/parent\."finalizedAt" IS NOT NULL OR parent\."status" NOT IN \('DRAFT', 'PENDING'\)/g)).toHaveLength(2)
    expect(sql).toContain('parent."status" <> \'PENDING\'')
  })
  it("componentes ficam imutáveis e não podem ser criados sob item retirado", () => {
    expect(sql).toContain("IF TG_OP = 'UPDATE' THEN")
    expect(sql).toContain('IF item."removedAt" IS NOT NULL')
    expect(sql).toContain('NEW."unitOrdinal" > item."quantity"')
  })
  it("efeitos financeiros de snapshots retirados são recusados pelo banco", () => {
    expect(sql).toContain('IF retired IS DISTINCT FROM FALSE THEN')
    for (const table of ["InventoryMovement", "CommissionEntry"]) expect(sql).toContain(`CREATE TRIGGER "${table}_guard_active_snapshot" BEFORE INSERT`)
  })
  it("locks da venda e escrita MVCC também protegem contra clientes READ COMMITTED", () => {
    expect(sql.match(/FOR UPDATE/g)?.length).toBeGreaterThanOrEqual(3)
    expect(sql.match(/UPDATE "Sale" SET "version" = "version"/g)).toHaveLength(2)
  })
  it("consulta, autorização, finalização, cancelamento e reconciliação recebem apenas ativos", () => {
    expect(saleSelect.saleItem_sale.where).toEqual({ removedAt: null })
    expect(saleSelect.saleTip_sale.where).toEqual({ removedAt: null })
    for (const file of ["finalization", "cancellation", "transaction"]) expect(source(`src/lib/checkout/${file}.ts`)).toContain("saleSelect")
  })
  it("histórico e relatórios filtram ativos também na busca de profissional", () => {
    const history = source("src/lib/checkout/history.ts"), finance = source("src/lib/dashboard/checkout-finance.ts")
    expect(history).toContain("where: { barbershopId, removedAt: null }")
    expect(history).toContain("some: { barbershopId, removedAt: null, saleServiceComponent_saleItem")
    expect(history).toContain("OR: [{ removedAt: { not: null } }")
    expect(finance).toContain("saleItem_sale: { where: { removedAt: null }")
    expect(finance).toContain("some: { barbershopId, removedAt: null, saleServiceComponent_saleItem")
    expect(finance).toContain('sale.status !== "PAID"')
  })
  it("descarte verifica financeiro de todos os snapshots, inclusive retirados", () => {
    const discard = source("src/lib/checkout/voiding.ts")
    expect(discard).toContain("saleItem: { barbershopId, saleId: id }")
    expect(discard).not.toContain("saleItemId: { in:")
  })
})
