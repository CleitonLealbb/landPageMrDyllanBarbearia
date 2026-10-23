import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

const migrationName = "20261022120000_checkout_pdv_foundation"
const sql = readFileSync(`prisma/migrations/${migrationName}/migration.sql`, "utf8")
const schema = readFileSync("prisma/schema.prisma", "utf8")
const models = Prisma.dmmf.datamodel.models
const newModels = [
  "CheckoutActor", "ProductCategory", "Product", "InventoryBalance", "InventoryMovement",
  "Sale", "SaleItem", "SaleServiceComponent", "SaleTip", "Payment", "CommissionEntry",
  "CashRegister", "CashSession", "CashMovement", "CheckoutAuditEvent", "CheckoutIdempotency",
]
const existingModels = ["User", "Professional", "Barbershop", "BarbershopUser", "CustomerAccount", "BarbershopCustomer", "Service", "ServicePackage", "ServicePackageItem", "ServiceCategory", "ProfessionalService", "TvMedia"]
const model = (name: string) => models.find(m => m.name === name)!
const field = (name: string, property: string) => model(name).fields.find(f => f.name === property)!
const quotedNames = (value: string) => [...value.matchAll(/"([^"]+)"/g)].map(m => m[1])
const sqlIndexes = [...sql.matchAll(/CREATE (UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"\(([^)]+)\)([^;]*);/g)].map(m => ({ unique: Boolean(m[1]), name: m[2], table: m[3], columns: quotedNames(m[4]), predicate: m[5].trim(), position: m.index! }))
const sqlForeignKeys = [...sql.matchAll(/ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \(([^)]+)\) REFERENCES "([^"]+)"\(([^)]+)\) ON DELETE (\w+) ON UPDATE (\w+);/g)].map(m => ({ table: m[1], name: m[2], columns: quotedNames(m[3]), target: m[4], references: quotedNames(m[5]), onDelete: m[6], onUpdate: m[7], position: m.index! }))
const sqlFunctions = [...sql.matchAll(/CREATE FUNCTION "([^"]+)"\(\) RETURNS trigger LANGUAGE plpgsql AS \$\$([\s\S]*?)\$\$;/g)].map(m => ({ name: m[1], body: m[2], position: m.index! }))
const sqlTriggers = [...sql.matchAll(/CREATE TRIGGER "([^"]+)" BEFORE ([\w ]+) ON "([^"]+)" FOR EACH ROW EXECUTE FUNCTION "([^"]+)"\(\);/g)].map(m => ({ name: m[1], events: m[2], table: m[3], fn: m[4], position: m.index! }))

describe("Checkout: revisão cruzada integral dos artefatos", () => {
  it("declara exatamente os 13 enums novos com todos os valores corretos", () => {
    const enums = [...sql.matchAll(/CREATE TYPE "([^"]+)" AS ENUM \(([^)]+)\);/g)]
    expect(enums).toHaveLength(13)
    for (const [, name, values] of enums) {
      const datamodel = Prisma.dmmf.datamodel.enums.find(e => e.name === name)
      expect(datamodel, name).toBeDefined()
      expect([...values.matchAll(/'([^']+)'/g)].map(v => v[1])).toEqual(datamodel!.values.map(v => v.name))
    }
    const usedEnums = new Set(newModels.flatMap(name => model(name).fields.filter(f => f.kind === "enum").map(f => f.type)))
    expect([...usedEnums].filter(name => !["TenantRole", "CategoryStatus"].includes(name)).sort()).toEqual(enums.map(e => e[1]).sort())
  })

  it.each(newModels)("%s tem PK, uniques e índices do schema completos no SQL", name => {
    const block = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))![1]
    const ids = model(name).fields.filter(f => f.isId).map(f => f.name)
    expect(sql).toContain(`CONSTRAINT "${name}_pkey" PRIMARY KEY (${ids.map(id => `"${id}"`).join(", ")})`)
    for (const unique of model(name).uniqueFields) expect(sqlIndexes).toContainEqual(expect.objectContaining({ table: name, columns: unique, unique: true, predicate: "" }))
    for (const index of block.matchAll(/@@index\(\[([^\]]+)\]/g)) {
      expect(sqlIndexes).toContainEqual(expect.objectContaining({ table: name, columns: index[1].split(",").map(c => c.trim()), unique: false, predicate: "" }))
    }
  })

  it.each(newModels)("%s possui todas as FKs e ações referenciais equivalentes ao schema", name => {
    const relations = model(name).fields.filter(f => f.relationFromFields?.length)
    expect(sqlForeignKeys.filter(fk => fk.table === name)).toHaveLength(relations.length)
    const block = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))![1]
    for (const relation of relations) {
      const fk = sqlForeignKeys.find(fk => fk.table === name && fk.target === relation.type && JSON.stringify(fk.columns) === JSON.stringify(relation.relationFromFields))
      expect(fk, `${name}.${relation.name}`).toBeDefined()
      expect(fk!.references).toEqual(relation.relationToFields)
      expect(fk!.onDelete).toBe("RESTRICT")
      expect(fk!.onUpdate).toBe("RESTRICT")
      const line = block.split("\n").find(line => new RegExp(`^\\s*${relation.name}\\s`).test(line))!
      expect(line).toContain("onDelete: Restrict, onUpdate: Restrict")
      for (const column of fk!.columns) expect(field(name, column)).toBeDefined()
      for (const column of fk!.references) expect(field(fk!.target, column)).toBeDefined()
      if (relation.type !== "Barbershop") expect(fk!.columns[0]).toBe(fk!.references[0])
    }
  })

  it("não cria FKs ou índices órfãos nem repete/trunca nomes de objetos", () => {
    expect(sqlForeignKeys).toHaveLength(newModels.reduce((sum, name) => sum + model(name).fields.filter(f => f.relationFromFields?.length).length, 0))
    for (const index of sqlIndexes) for (const column of index.columns) expect(field(index.table, column), `${index.table}.${column}`).toBeDefined()
    const constraints = [...sql.matchAll(/(?:ADD )?CONSTRAINT "([^"]+)"/g)].map(m => m[1])
    const names = [...constraints, ...sqlIndexes.map(i => i.name), ...sqlFunctions.map(f => f.name), ...sqlTriggers.map(t => t.name)]
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(Buffer.byteLength(name, "utf8"), name).toBeLessThanOrEqual(63)
    const previousSql = readdirSync("prisma/migrations", { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== migrationName).map(e => readFileSync(`prisma/migrations/${e.name}/migration.sql`, "utf8")).join("\n")
    for (const name of names) expect(previousSql.includes(`"${name}"`), name).toBe(false)
  })

  it("ordena enums, tabelas, índices únicos, FKs, funções e triggers sem dependências futuras", () => {
    for (const name of newModels) {
      const creation = sql.indexOf(`CREATE TABLE "${name}"`)
      const table = sql.slice(creation, sql.indexOf("\n);", creation))
      for (const scalar of model(name).fields.filter(f => f.kind === "enum")) {
        if (!["TenantRole", "CategoryStatus"].includes(scalar.type)) expect(sql.indexOf(`CREATE TYPE "${scalar.type}"`)).toBeLessThan(creation)
        expect(table).toContain(`"${scalar.name}" "${scalar.type}"`)
      }
    }
    for (const fk of sqlForeignKeys) {
      expect(sql.indexOf(`CREATE TABLE "${fk.table}"`)).toBeLessThan(fk.position)
      if (newModels.includes(fk.target)) expect(sql.indexOf(`CREATE TABLE "${fk.target}"`)).toBeLessThan(fk.position)
      const target = model(fk.target)
      const primary = target.fields.filter(f => f.isId).map(f => f.name)
      expect([primary, ...target.uniqueFields]).toContainEqual(fk.references)
      if (newModels.includes(fk.target) && JSON.stringify(primary) !== JSON.stringify(fk.references)) {
        expect(sqlIndexes.find(i => i.table === fk.target && i.unique && JSON.stringify(i.columns) === JSON.stringify(fk.references))!.position).toBeLessThan(fk.position)
      }
    }
    for (const trigger of sqlTriggers) {
      expect(sql.indexOf(`CREATE TABLE "${trigger.table}"`)).toBeLessThan(trigger.position)
      expect(sqlFunctions.find(f => f.name === trigger.fn)!.position).toBeLessThan(trigger.position)
    }
  })

  it("funções e triggers referenciam tabelas e campos reais", () => {
    expect(sqlFunctions).toHaveLength(11)
    expect(sqlTriggers).toHaveLength(31)
    for (const fn of sqlFunctions) {
      for (const reference of fn.body.matchAll(/(?:FROM|INTO) "(\w+)"/g)) expect(model(reference[1])).toBeDefined()
      for (const variable of fn.body.matchAll(/(\w+) "(\w+)"%ROWTYPE/g)) {
        expect(model(variable[2])).toBeDefined()
        for (const property of fn.body.matchAll(new RegExp(`\\b${variable[1]}\\."(\\w+)"`, "g"))) expect(field(variable[2], property[1]), `${fn.name}: ${variable[1]}.${property[1]}`).toBeDefined()
      }
      for (const trigger of sqlTriggers.filter(t => t.fn === fn.name)) {
        for (const property of fn.body.matchAll(/(?:NEW|OLD)\."(\w+)"/g)) expect(field(trigger.table, property[1]), `${fn.name}: ${trigger.table}.${property[1]}`).toBeDefined()
      }
    }
  })

  it("SQL é autocontido e não executa remoções nem depende de rascunhos", () => {
    expect(sql).not.toMatch(/\.tmp-checkout|\\(?:i|ir)\s|^\s*:r\s|^\s*SOURCE\s/im)
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE)\b|\bDELETE\s+FROM\b|\bCASCADE\b/i)
    expect(sql).not.toMatch(/CREATE (?:DATABASE|EXTENSION)|ALTER TYPE|IF NOT EXISTS/i)
    expect(sql.match(/^BEGIN;/gm)).toHaveLength(1)
    expect(sql.match(/^COMMIT;/gm)).toHaveLength(1)
    // Raw DDL is intentionally not replayable: Prisma must skip a completed migration.
    expect(sql).toContain('CREATE TABLE "Sale"')
  })

  it("cancelamento preserva a venda mas deixa inserir reversões e estornar pagamentos", () => {
    const sale = sqlFunctions.find(f => f.name === "checkout_guard_sale")!.body
    expect(sale).toContain("NEW.\"status\" NOT IN ('PAID', 'CANCELED')")
    expect(sale).toContain("IF NEW.\"status\" = 'PAID' THEN")
    const payment = sqlFunctions.find(f => f.name === "checkout_guard_payment")!.body
    expect(payment).toContain("OLD.\"status\" <> 'RECORDED' OR NEW.\"status\" <> 'REFUNDED'")
    expect(payment).toContain("TG_OP = 'UPDATE' AND parent.\"status\" <> 'CANCELED'")
    const cash = sqlFunctions.find(f => f.name === "checkout_validate_cash_movement")!.body
    expect(cash).toContain('"id" = NEW."cashSessionId" FOR UPDATE')
    expect(cash).not.toContain('original."cashSessionId" <> NEW."cashSessionId"')
    for (const name of ["InventoryMovement", "CommissionEntry", "CashMovement"]) {
      const triggers = sqlTriggers.filter(t => t.table === name)
      expect(triggers.some(t => t.events === "INSERT")).toBe(true)
      expect(triggers.filter(t => t.fn === "checkout_reject_mutation").every(t => !t.events.includes("INSERT"))).toBe(true)
    }
    expect(sqlFunctions.find(f => f.name === "checkout_guard_commission_update")!.body).toContain("append a reversal first")
  })
})

describe("Checkout: tenant, identidade e snapshots", () => {
  it.each(newModels)("%s possui tenant obrigatório, chave composta e FK restritiva", name => {
    expect(field(name, "barbershopId")).toMatchObject({ type: "String", isRequired: true })
    expect(model(name).uniqueFields).toContainEqual(["barbershopId", "id"])
    expect(field(name, "barbershop")).toMatchObject({ relationFromFields: ["barbershopId"], relationToFields: ["id"], relationOnDelete: "Restrict" })
    expect(sql).toContain(`CREATE TABLE "${name}"`)
  })

  it.each(newModels)("%s nunca referencia outro tenant por id isolado", name => {
    const relations = model(name).fields.filter(f => f.kind === "object" && f.relationFromFields?.length && f.type !== "Barbershop")
    for (const relation of relations) {
      expect(relation.relationFromFields?.[0]).toBe("barbershopId")
      expect(relation.relationToFields?.[0]).toBe("barbershopId")
      expect(relation.relationOnDelete).toBe("Restrict")
    }
  })

  it.each(newModels)("%s mantém SQL consistente com tipos e nulabilidade do datamodel", name => {
    const table = sql.match(new RegExp(`CREATE TABLE "${name}" \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? ""
    const types: Record<string, string> = { String: "TEXT", Int: "INTEGER", Boolean: "BOOLEAN", DateTime: "TIMESTAMP(3)", Json: "JSONB" }
    const columns = [...table.matchAll(/^\s+"(\w+)" ([^\n]+)/gm)]
    const scalars = model(name).fields.filter(f => f.kind !== "object")
    expect(columns.map(c => c[1]).sort()).toEqual(scalars.map(f => f.name).sort())
    for (const scalar of scalars) {
      const column = columns.find(c => c[1] === scalar.name)![2]
      expect(column.startsWith(types[scalar.type] ?? `"${scalar.type}"`)).toBe(true)
      expect(column.includes("NOT NULL")).toBe(scalar.isRequired)
    }
  })

  it("suporta cliente opcional e identidades reais sem redefinir papéis", () => {
    expect(field("Sale", "customerId").isRequired).toBe(false)
    expect(field("CheckoutActor", "membership").relationToFields).toEqual(["barbershopId", "userId"])
    expect(field("CheckoutActor", "professional").relationToFields).toEqual(["barbershopId", "id"])
    expect(field("CheckoutActor", "roleSnapshot").type).toBe("TenantRole")
    expect(sql).toContain('"CheckoutActor_identity_check"')
    expect(sql).toContain('"identityType" = \'USER\' AND "userId" IS NOT NULL AND "professionalId" IS NULL')
    expect(sql).not.toMatch(/CREATE TYPE "(?:Role|TenantRole|ProfessionalPermissionLevel)"/)
  })

  it("mantém dinheiro e percentuais em inteiros e snapshots obrigatórios", () => {
    for (const name of newModels) {
      for (const f of model(name).fields.filter(f => /Cents$|BasisPoints$|^basisPoints$/.test(f.name))) expect(f.type).toBe("Int")
      expect(model(name).fields.some(f => f.type === "Float" || f.type === "Decimal")).toBe(false)
    }
    for (const property of ["nameSnapshot", "unitPriceCents", "originalUnitPriceCents", "quantity", "subtotalCents", "totalCents"]) expect(field("SaleItem", property).isRequired).toBe(true)
    for (const property of ["professionalId", "professionalNameSnapshot", "serviceNameSnapshot", "originalPriceCents", "allocationWeightCents", "allocatedGrossCents", "allocatedDiscountCents", "commissionBaseCents", "commissionBasisPoints", "commissionCents"]) expect(field("SaleServiceComponent", property).isRequired).toBe(true)
    expect(field("SaleTip", "professional").relationFromFields).toEqual(["barbershopId", "professionalId"])
  })

  it("não cria agenda nem modifica autenticação", () => {
    expect(models.some(m => m.name === "Appointment")).toBe(false)
    expect(sql).not.toMatch(/CREATE TABLE "Appointment/)
    expect(sql).toContain('"Sale_origin_phase2_check" CHECK ("origin" = \'WALK_IN\')')
    expect(sql).toContain('"Sale_coupon_phase2_check" CHECK ("discountKind" <> \'COUPON\')')
  })
})

describe("Checkout: invariantes SQL revisáveis", () => {
  it.each([
    "Product_money_check", "InventoryBalance_nonnegative_check", "InventoryMovement_quantity_check",
    "Sale_money_check", "Sale_discount_check", "Sale_lifecycle_check", "SaleItem_money_check",
    "SaleItem_catalog_kind_check", "SaleServiceComponent_money_check", "SaleTip_positive_check",
    "Payment_money_check", "Payment_refund_check", "CommissionEntry_money_check",
    "CashSession_money_check", "CashSession_lifecycle_check", "CashMovement_money_check",
    "CashMovement_links_check", "CheckoutIdempotency_result_check",
  ])("contém a constraint %s", constraint => {
    expect(sql).toContain(`ADD CONSTRAINT "${constraint}" CHECK (`)
  })

  it("impede estoque negativo e prepara compare-and-swap", () => {
    expect(sql).toContain('CHECK ("quantity" >= 0 AND "version" >= 0)')
    expect(model("InventoryBalance").uniqueFields).toContainEqual(["barbershopId", "productId"])
    expect(field("InventoryBalance", "version").type).toBe("Int")
    expect(sql).toContain('"quantityDelta" <> 0')
    expect(sql).toContain('"kind" <> \'SALE\' OR ("quantityDelta" < 0 AND "saleItemId" IS NOT NULL)')
  })

  it("garante equações locais sem overflow intermediário ou float", () => {
    expect(sql).toContain('"totalCents"::bigint = "servicesSubtotalCents"::bigint + "productsSubtotalCents"::bigint - "discountCents"::bigint + "tipCents"::bigint')
    expect(sql).toContain('"subtotalCents"::bigint = "unitPriceCents"::bigint * "quantity"::bigint')
    expect(sql).toContain('"totalCents" = "subtotalCents" - "discountCents"')
    expect(sql).toContain('"commissionBaseCents" = "allocatedGrossCents" - "allocatedDiscountCents"')
    expect(sql).toContain('"commissionBasisPoints" BETWEEN 0 AND 10000')
    expect(sql).toContain('"basisPoints" BETWEEN 0 AND 10000')
    expect(sql).toContain('"commissionBaseCents"::bigint * "commissionBasisPoints"::bigint + 5000) / 10000')
  })

  it("separa cupom de desconto e restringe troco a dinheiro", () => {
    expect(sql).toContain('"discountKind" = \'MANUAL_PERCENT\' AND "discountBasisPoints" IS NOT NULL')
    expect(sql).toContain('"discountBasisPoints" BETWEEN 0 AND 10000 AND "couponCodeSnapshot" IS NULL')
    expect(sql).toContain('"method" <> \'CASH\' AND "cashReceivedCents" IS NULL AND "changeCents" = 0')
    expect(sql).toContain('"changeCents" = "cashReceivedCents" - "appliedCents"')
    expect(sql).not.toMatch(/"(?:cardNumber|cvv|pan|cardToken)"/i)
    expect(sql).toContain('"refundedCents" = "appliedCents"')
  })

  it.each(["InventoryMovement", "CommissionEntry", "CashMovement"])("%s impede reversão duplicada, autorreferência e tenant externo", name => {
    expect(model(name).uniqueFields).toContainEqual(["barbershopId", "reversalOfId"])
    expect(sql).toContain(`CREATE UNIQUE INDEX "${name}_barbershopId_reversalOfId_key" ON "${name}"("barbershopId", "reversalOfId")`)
    expect(sql).toMatch(new RegExp(`ALTER TABLE "${name}" ADD CONSTRAINT "[^"]+" FOREIGN KEY \\("barbershopId", "reversalOfId",`))
    expect(sql).toContain('"reversalOfId" IS DISTINCT FROM "id"')
  })

  it("reversões compensam exatamente o original", () => {
    expect(sql).toContain('NEW."quantityDelta"::bigint <> -original."quantityDelta"::bigint')
    expect(sql).toContain('original."saleItemId" IS DISTINCT FROM NEW."saleItemId"')
    expect(sql).toContain('original."kind" <> \'EARNED\'')
    expect(sql).toContain('original."amountCents" <> NEW."amountCents"')
    expect(sql).toContain('component."commissionBasisPoints" <> NEW."basisPoints"')
    expect(sql).toContain('"CommissionEntry_guard_update"')
  })

  it("garante SKU e barcode únicos por tenant e cliente tenant-safe", () => {
    for (const identifier of ["sku", "barcode"]) expect(model("Product").uniqueFields).toContainEqual(["barbershopId", identifier])
    expect(model("BarbershopCustomer").uniqueFields).toContainEqual(["barbershopId", "id"])
    expect(field("Sale", "customer").relationFromFields).toEqual(["barbershopId", "customerId"])
    expect(sql).toContain('REFERENCES "BarbershopCustomer"("barbershopId", "id") ON DELETE RESTRICT')
  })

  it("permite apenas uma sessão aberta e uma abertura por caixa/sessão", () => {
    expect(sql).toContain('CREATE UNIQUE INDEX "CashSession_one_open_per_register" ON "CashSession"("barbershopId", "cashRegisterId") WHERE "status" = \'OPEN\'')
    expect(sql).toContain('CREATE UNIQUE INDEX "CashMovement_one_opening_per_session"')
    expect(sql).toContain('"differenceCents"::bigint = "countedBalanceCents"::bigint - "expectedBalanceCents"::bigint')
    expect(sql).toContain('An open cash session is required to finalize')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('payment."method" <> \'CASH\'')
  })

  it("guarda histórico contra exclusão e alteração dos lançamentos", () => {
    for (const name of newModels) expect(sql).toContain(`CREATE TRIGGER "${name}_no_delete" BEFORE DELETE ON "${name}"`)
    for (const name of ["CheckoutActor", "InventoryMovement", "CashMovement", "CheckoutAuditEvent", "CheckoutIdempotency"]) expect(sql).toContain(`CREATE TRIGGER "${name}_immutable" BEFORE UPDATE ON "${name}"`)
    for (const name of ["Sale", "SaleItem", "SaleTip", "SaleServiceComponent", "Payment"]) expect(sql).toMatch(new RegExp(`CREATE TRIGGER "${name}_guard_(?:history|snapshot)"`))
  })

  it("idempotência é por tenant/operação/chave e preserva hash/resultado", () => {
    expect(model("CheckoutIdempotency").uniqueFields).toContainEqual(["barbershopId", "operation", "key"])
    for (const property of ["requestHash", "responseStatus", "result", "actorId"]) expect(field("CheckoutIdempotency", property).isRequired).toBe(true)
    expect(sql).toContain('"requestHash" ~ \'^[0-9a-f]{64}$\'')
  })
})

describe("Checkout: migration exclusivamente aditiva", () => {
  it("é transacional, não apaga dados nem altera tabelas antigas", () => {
    expect(sql.trim().startsWith("BEGIN;")).toBe(true)
    expect(sql.trim().endsWith("COMMIT;")).toBe(true)
    // BEFORE DELETE is a protective trigger, never a destructive DML statement.
    expect(sql).not.toMatch(/^\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\s/im)
    expect(sql).not.toMatch(/ON DELETE (?:CASCADE|SET NULL)/i)
    for (const name of existingModels) {
      expect(model(name)).toBeDefined()
      expect(sql).not.toContain(`ALTER TABLE "${name}"`)
      expect(sql).not.toContain(`CREATE TABLE "${name}"`)
    }
    expect(sql).toContain('CREATE UNIQUE INDEX "BarbershopCustomer_barbershopId_id_key"')
    expect([...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map(m => m[1]).sort()).toEqual([...newModels].sort())
    expect(schema).not.toMatch(/model Appointment\s*\{/)
  })

  it("preserva o conteúdo de todas as migrations anteriores em qualquer convenção de newline", () => {
    const hashes: Record<string, string> = {
  "0_init": "c09df9b830518b419745fb67ab71b30ddad44afb7555bc40c6937058740c0db7",
  "20260725021546_canonical_roles_and_session_version": "24ad42ac8c093c5a69d621fe0ffd35f588ac05a0c7bea7556ef81eb288c1d033",
  "20260806222509_mobile_customer_catalog_foundation": "8d213108e519a80c926bfadb2a5fcd825efa240b17f29db52ba23a94263454ad",
  "20260813010000_service_categories": "ca8dac3f2978705af612e2c243206cac94efad60a428f6dd20b9e310923e3446",
  "20260813020000_link_owner_professional_profile": "a142cfde984e2caf0ea685d5a4fccd5e1250a1ce81aecf4334376b8408fbbda4",
  "20260814010000_service_packages": "668eccd10cd0513dd8bdb7cebea7c02d4262ff22fedec63f749733f78a45b8e5",
  "20260814020000_service_package_duration": "6a642bd8a2c34dbbc0c80eb99d50f52fbcd6d60a4cb4042e30c6b7be949a6d7f",
  "20260924_add_tv_media": "b748b5c342cf75cd586872051825abe62f3a08fad662ce85e873488acb1b9506",
  "20260929_add_tv_media_duration": "fec745eafd755599ce4e81507a46ca4f13a7fabca409c289e399266d8bfcf02a"
}
    expect(readdirSync("prisma/migrations", { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== migrationName).map(e => e.name).sort()).toEqual(Object.keys(hashes).sort())
    for (const [name, hash] of Object.entries(hashes)) expect(createHash("sha256").update(readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8").replace(/\r\n/g, "\n")).digest("hex")).toBe(hash)
  })

  it("preserva todos os campos, tipos e nulabilidade dos modelos anteriores", () => {
    const baseline: Record<string, Record<string, string>> = {
  "User": {
    "id": "String",
    "name": "String",
    "email": "String",
    "password": "String",
    "role": "Role",
    "sessionVersion": "Int",
    "photoUrl": "String?",
    "resetToken": "String?",
    "resetExpires": "DateTime?",
    "createdAt": "DateTime",
    "memberships": "BarbershopUser[]"
  },
  "Professional": {
    "id": "String",
    "barbershopId": "String",
    "userId": "String?",
    "name": "String",
    "email": "String?",
    "role": "String",
    "permissionLevel": "ProfessionalPermissionLevel",
    "sessionVersion": "Int",
    "commission": "Int",
    "specialties": "String[]",
    "photoUrl": "String?",
    "status": "String",
    "password": "String?",
    "inviteToken": "String?",
    "inviteExpires": "DateTime?",
    "resetToken": "String?",
    "resetExpires": "DateTime?",
    "createdAt": "DateTime",
    "barbershop": "Barbershop",
    "membership": "BarbershopUser?",
    "services": "ProfessionalService[]"
  },
  "Barbershop": {
    "id": "String",
    "name": "String",
    "phone": "String?",
    "email": "String?",
    "address": "String?",
    "status": "String",
    "createdAt": "DateTime",
    "slug": "String",
    "timezone": "String",
    "members": "BarbershopUser[]",
    "professionals": "Professional[]",
    "customers": "BarbershopCustomer[]",
    "services": "Service[]",
    "serviceCategories": "ServiceCategory[]",
    "servicePackages": "ServicePackage[]",
    "tvMedia": "TvMedia[]"
  },
  "BarbershopUser": {
    "id": "String",
    "userId": "String",
    "barbershopId": "String",
    "role": "TenantRole",
    "createdAt": "DateTime",
    "user": "User",
    "barbershop": "Barbershop",
    "professionalProfiles": "Professional[]"
  },
  "CustomerAccount": {
    "id": "String",
    "name": "String",
    "email": "String",
    "passwordHash": "String",
    "phone": "String?",
    "sessionVersion": "Int",
    "createdAt": "DateTime",
    "updatedAt": "DateTime",
    "barbershops": "BarbershopCustomer[]"
  },
  "BarbershopCustomer": {
    "id": "String",
    "barbershopId": "String",
    "customerAccountId": "String",
    "status": "CustomerStatus",
    "internalNotes": "String?",
    "createdAt": "DateTime",
    "updatedAt": "DateTime",
    "barbershop": "Barbershop",
    "customerAccount": "CustomerAccount"
  },
  "Service": {
    "id": "String",
    "barbershopId": "String",
    "categoryId": "String?",
    "name": "String",
    "description": "String?",
    "priceCents": "Int",
    "durationMinutes": "Int",
    "status": "ServiceStatus",
    "displayOrder": "Int",
    "createdAt": "DateTime",
    "updatedAt": "DateTime",
    "barbershop": "Barbershop",
    "professionals": "ProfessionalService[]",
    "category": "ServiceCategory?",
    "packageItems": "ServicePackageItem[]"
  },
  "ServicePackage": {
    "id": "String",
    "barbershopId": "String",
    "name": "String",
    "description": "String?",
    "priceCents": "Int",
    "durationMinutes": "Int",
    "displayOrder": "Int",
    "status": "ServiceStatus",
    "createdAt": "DateTime",
    "updatedAt": "DateTime",
    "barbershop": "Barbershop",
    "items": "ServicePackageItem[]"
  },
  "ServicePackageItem": {
    "barbershopId": "String",
    "packageId": "String",
    "serviceId": "String",
    "displayOrder": "Int",
    "package": "ServicePackage",
    "service": "Service"
  },
  "ServiceCategory": {
    "id": "String",
    "barbershopId": "String",
    "name": "String",
    "description": "String?",
    "displayOrder": "Int",
    "status": "CategoryStatus",
    "createdAt": "DateTime",
    "updatedAt": "DateTime",
    "barbershop": "Barbershop",
    "services": "Service[]"
  },
  "ProfessionalService": {
    "barbershopId": "String",
    "professionalId": "String",
    "serviceId": "String",
    "createdAt": "DateTime",
    "professional": "Professional",
    "service": "Service"
  },
  "TvMedia": {
    "id": "String",
    "barbershopId": "String",
    "name": "String",
    "url": "String",
    "type": "String",
    "order": "Int",
    "active": "Boolean",
    "duration": "Int?",
    "createdAt": "DateTime",
    "updatedAt": "DateTime",
    "barbershop": "Barbershop"
  }
}
    for (const [name, fields] of Object.entries(baseline)) {
      for (const [property, type] of Object.entries(fields)) {
        expect(field(name, property), `${name}.${property}`).toMatchObject({ type: type.replace(/\?|\[\]/g, ""), isRequired: !type.endsWith("?"), isList: type.endsWith("[]") })
      }
    }
  })
})
