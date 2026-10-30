import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

const a = readFileSync("prisma/migrations/20261029120000_agenda_foundation/migration.sql", "utf8")
const b = readFileSync("prisma/migrations/20261029120100_agenda_checkout_links/migration.sql", "utf8")
const sql = `${a}\n${b}`, schema = readFileSync("prisma/schema.prisma", "utf8")
const names = ["Appointment", "AppointmentItem", "AppointmentServiceComponent", "ScheduleEntry", "ScheduleCalendar", "ScheduleWeeklyWindow", "ScheduleDateException", "ScheduleExceptionWindow"]
const models = Prisma.dmmf.datamodel.models
const model = (name: string) => models.find(row => row.name === name)!
const field = (name: string, key: string) => model(name).fields.find(row => row.name === key)!
const block = (name: string) => schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))![1]
const quoted = (value: string) => [...value.matchAll(/"([^"]+)"/g)].map(row => row[1])
const foreignKeys = [...sql.matchAll(/ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \(([^)]+)\) REFERENCES "([^"]+)"\(([^)]+)\) ON DELETE (\w+) ON UPDATE (\w+);/g)]
const indexes = [...sql.matchAll(/CREATE (UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"\(([^)]+)\)([^;]*);/g)]
const functions = [...sql.matchAll(/CREATE(?: OR REPLACE)? FUNCTION "([^"]+)"\([^;]*?\) RETURNS (?:trigger|void|JSONB) LANGUAGE plpgsql AS \$\$([\s\S]*?)\$\$;/g)]
// Focused structural regression, not a PostgreSQL compiler or a DDL splitter.
// PL/pgSQL's IF reader ends at the first THEN at parentheses depth zero.
// Ignore quoted tokens/comments so CASE/THEN in identifiers or text cannot
// satisfy the check. A SQL CASE must be complete at that actual boundary.
function ifExpression(source: string) {
  const tokens = [...source.matchAll(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|[^\s]/g)]
    .map(match => match[0]).filter(token => !token.startsWith("--") && !token.startsWith("/*"))
  if (tokens[0] !== "IF") throw new Error("Expected IF")
  const nesting: string[] = []
  let cases = 0
  for (let index = 1; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === "THEN" && nesting.length === 0) {
      if (cases !== 0) throw new Error("Unfinished SQL CASE at PL/pgSQL IF boundary")
      return tokens.slice(1, index)
    }
    if (token === "(" || token === "[") nesting.push(token)
    else if (token === ")" || token === "]") {
      if (nesting.pop() !== (token === ")" ? "(" : "[")) throw new Error("Mismatched parentheses")
    } else if (token === "CASE") cases++
    else if (token === "END") { if (--cases < 0) throw new Error("Unexpected CASE end") }
    else if (token === ";") break
  }
  throw new Error("Incomplete IF expression")
}
const historical: Record<string, string> = {
  "0_init": "c09df9b830518b419745fb67ab71b30ddad44afb7555bc40c6937058740c0db7",
  "20260725021546_canonical_roles_and_session_version": "24ad42ac8c093c5a69d621fe0ffd35f588ac05a0c7bea7556ef81eb288c1d033",
  "20260806222509_mobile_customer_catalog_foundation": "8d213108e519a80c926bfadb2a5fcd825efa240b17f29db52ba23a94263454ad",
  "20260813010000_service_categories": "ca8dac3f2978705af612e2c243206cac94efad60a428f6dd20b9e310923e3446",
  "20260813020000_link_owner_professional_profile": "a142cfde984e2caf0ea685d5a4fccd5e1250a1ce81aecf4334376b8408fbbda4",
  "20260814010000_service_packages": "668eccd10cd0513dd8bdb7cebea7c02d4262ff22fedec63f749733f78a45b8e5",
  "20260814020000_service_package_duration": "6a642bd8a2c34dbbc0c80eb99d50f52fbcd6d60a4cb4042e30c6b7be949a6d7f",
  "20260924_add_tv_media": "b748b5c342cf75cd586872051825abe62f3a08fad662ce85e873488acb1b9506",
  "20260929_add_tv_media_duration": "fec745eafd755599ce4e81507a46ca4f13a7fabca409c289e399266d8bfcf02a",
  "20261022120000_checkout_pdv_foundation": "b40706bafc64c50961fbc3145aa4cb871638e1c5dd0039ed3db7c415aad8a38f",
  "20261022130000_checkout_duration_snapshots": "b2fa0455fcab9d52be76beed0b5d49c862045fdeecf5a041db585dcaa9f1352b",
  "20261024160000_checkout_sale_voided_enum": "4ba7dce976ebaa6425db45360b0da7997be2c5d6e95d0f1c40b27891f362710e",
  "20261024160100_checkout_sale_voided_guards": "bf89772de2b1108a6edacdcf984416152dbc5dc681447fec06b1953274817d61",
  "20261024170000_checkout_pending_snapshots": "3d7d0d2c1656bf226e12ea812eee90afc5991a5d1b29b34b7a9b747a9996a008",
}
describe("Agenda A: schema e SQL equivalentes, sem banco", () => {
  it("contém exatamente os oito modelos e sete enums novos", () => {
    expect([...a.matchAll(/CREATE TABLE "([^"]+)"/g)].map(row => row[1])).toEqual(names)
    const enums = [...a.matchAll(/CREATE TYPE "([^"]+)" AS ENUM \(([^)]+)\);/g)]
    expect(enums).toHaveLength(7)
    for (const row of enums) expect([...row[2].matchAll(/'([^']+)'/g)].map(value => value[1])).toEqual(Prisma.dmmf.datamodel.enums.find(value => value.name === row[1])!.values.map(value => value.name))
    expect(enums.find(row => row[1] === "AppointmentStatus")![2]).not.toMatch(/DRAFT/)
    expect(enums.find(row => row[1] === "AppointmentOrigin")![2]).not.toMatch(/IMPORTED/)
  })
  it.each(names)("%s: todas as colunas, tipos, nulabilidade e PK correspondem", name => {
    const table = a.match(new RegExp(`CREATE TABLE "${name}" \\(([\\s\\S]*?)\\n\\);`))![1]
    const columns = [...table.matchAll(/^\s+"(\w+)" ([^\n]+)/gm)]
    const scalars = model(name).fields.filter(row => row.kind !== "object")
    expect(columns.map(row => row[1]).sort()).toEqual(scalars.map(row => row.name).sort())
    const types: Record<string, string> = { String: "TEXT", Int: "INTEGER", DateTime: "TIMESTAMPTZ(3)" }
    for (const scalar of scalars) {
      const column = columns.find(row => row[1] === scalar.name)![2]
      const line = block(name).split("\n").find(line => new RegExp(`^\\s*${scalar.name}\\s`).test(line))!
      expect(column.startsWith(line.includes("@db.Date") ? "DATE" : types[scalar.type] ?? `"${scalar.type}"`), `${name}.${scalar.name}`).toBe(true)
      expect(column.includes("NOT NULL")).toBe(scalar.isRequired)
      if (!scalar.hasDefaultValue || (typeof scalar.default === "object" && scalar.default !== null && "name" in scalar.default && scalar.default.name === "uuid")) {
        expect(column, `${name}.${scalar.name}: client-side or absent default`).not.toContain("DEFAULT")
      } else if (typeof scalar.default === "object" && scalar.default !== null && "name" in scalar.default && scalar.default.name === "now") {
        expect(column).toContain("DEFAULT CURRENT_TIMESTAMP")
      } else {
        expect(column).toContain(`DEFAULT ${typeof scalar.default === "string" ? `'${scalar.default}'` : scalar.default}`)
      }
    }
    expect(table).toContain(`CONSTRAINT "${name}_pkey" PRIMARY KEY ("id")`)
    expect(field(name, "barbershopId")).toMatchObject({ isRequired: true, type: "String" })
  })
  it.each(names)("%s: FKs, uniques e índices do Prisma estão completos", name => {
    const relations = model(name).fields.filter(row => row.relationFromFields?.length)
    expect(foreignKeys.filter(row => row[1] === name)).toHaveLength(relations.length)
    for (const relation of relations) {
      const fk = foreignKeys.find(row => row[1] === name && row[4] === relation.type && JSON.stringify(quoted(row[3])) === JSON.stringify(relation.relationFromFields))!
      expect(fk, `${name}.${relation.name}`).toBeDefined(); expect(quoted(fk[5])).toEqual(relation.relationToFields)
      expect(fk[6]).toBe("RESTRICT"); expect(fk[7]).toBe("RESTRICT")
      if (relation.type !== "Barbershop") { expect(quoted(fk[3])[0]).toBe("barbershopId"); expect(quoted(fk[5])[0]).toBe("barbershopId") }
    }
    for (const fields of model(name).uniqueFields) expect(indexes.some(row => row[1] && row[3] === name && JSON.stringify(quoted(row[4])) === JSON.stringify(fields) && !row[5].trim())).toBe(true)
    for (const row of block(name).matchAll(/@@index\(\[([^\]]+)\]/g)) expect(indexes.some(index => index[3] === name && JSON.stringify(quoted(index[4])) === JSON.stringify(row[1].split(",").map(value => value.trim())))).toBe(true)
  })
  it("componentes correspondem ao profissional do item e ativos ao Appointment", () => {
    expect(field("Appointment", "professionalId").isRequired).toBe(true)
    expect(field("AppointmentServiceComponent", "item").relationFromFields).toEqual(["barbershopId", "appointmentItemId", "professionalId"])
    expect(a).toContain('NEW."professionalId" <> parent."professionalId"')
    expect(a).toContain('"removedAt" IS NULL AND "professionalId" <> parent."professionalId"')
    expect(a).toContain('FROM "ProfessionalService"')
    expect(a).toContain('Professional must remain enabled before attendance starts')
  })
  it("cliente cadastrado é local; avulso tem nome obrigatório sem conta inventada", () => {
    expect(field("Appointment", "customerId").isRequired).toBe(false)
    expect(field("Appointment", "customer").type).toBe("BarbershopCustomer")
    expect(field("Appointment", "customerNameSnapshot").isRequired).toBe(true)
    expect(field("Appointment", "customerContactSnapshot").isRequired).toBe(false)
    expect(a).toContain('length(btrim("customerNameSnapshot")) BETWEEN 1 AND 200')
    expect(a).not.toMatch(/INSERT INTO "CustomerAccount"/)
  })
  it("durações/quantidades positivas e preço zero válido, sem override parcial NULL", () => {
    expect(a).toContain('"durationMinutesSnapshot" > 0'); expect(a).toContain('"quantity" BETWEEN 1 AND 100'); expect(a).toContain('"priceCentsSnapshot" >= 0')
    expect(a).toContain('"adjustedDurationMinutes" IS NOT NULL AND "adjustedDurationMinutes" > 0')
    expect(a).toContain('"durationAdjustedById" <> NEW."updatedById"')
    expect(a).toContain('NEW."updatedById",NEW."professionalId",true')
    expect(a).toContain('make_interval(mins => coalesce(parent."adjustedDurationMinutes",parent."plannedDurationMinutes"))')
  })
  it("snapshots preservam preço/duração/composição de criação e não aceitam reescrita", () => {
    expect(a).toContain('catalog."name",catalog."priceCents",catalog."durationMinutes"')
    expect(a).toContain('pack."name",pack."priceCents",pack."durationMinutes"')
    expect(a).toContain('Snapshots can only be retired once')
    expect(a).toContain('CREATE TRIGGER "AppointmentComponent_immutable" BEFORE UPDATE')
    expect(a).toContain('i."componentCountSnapshot"')
    expect(a).toContain('CREATE UNIQUE INDEX "AppointmentComponent_one_service"')
  })
  it("ocupação compartilhada protege os três tipos de disputa com intervalos semiabertos", () => {
    const exclusion = a.match(/ADD CONSTRAINT "ScheduleEntry_no_overlap" EXCLUDE USING gist \(([\s\S]*?)WHERE \("releasedAt" IS NULL\);/)![1]
    expect(exclusion).toContain('"barbershopId" WITH ='); expect(exclusion).toContain('"professionalId" WITH =')
    expect(exclusion).toContain(`tstzrange("startsAt","endsAt",'[)')`); expect(exclusion).toContain("WITH &&")
    expect(exclusion).not.toContain('"kind"')
    expect(a).toContain('isfinite("startsAt") AND isfinite("endsAt") AND "startsAt" < "endsAt"')
    expect(a).toContain('WHERE "appointmentId" IS NOT NULL AND "releasedAt" IS NULL')
    expect(a).toContain('CREATE EXTENSION IF NOT EXISTS btree_gist;')
    expect(a).toContain('BEFORE DELETE ON "ScheduleEntry"')
  })
  it("bloqueios têm motivo, autor e liberação única; barbeiro somente próprio e futuro", () => {
    expect(a).toContain('"kind" = \'BLOCK\' AND "appointmentId" IS NULL AND "blockReason" IS NOT NULL AND "reason" IS NOT NULL')
    expect(a).toContain('own_id IS DISTINCT FROM professional_id')
    expect(a).toContain('NEW."startsAt" <= statement_timestamp()')
    expect(a).toContain('Occupations can only be released once')
    expect(a).toContain('NEW."version" <> OLD."version" + 1')
  })
  it("origem, terminais e transições são protegidos no SQL", () => {
    expect(a).toContain('NEW."origin" <> OLD."origin"')
    expect(a).toContain('OLD."status" IN (\'COMPLETED\',\'CANCELED\',\'NO_SHOW\')')
    expect(a).toContain('Invalid appointment transition')
    expect(a).toContain('Started appointment snapshots are frozen')
    expect(a).toContain('No-show cannot precede scheduled start')
    expect(a).toContain('"releasedAt" IS NULL AND "startsAt" <= NEW."noShowAt"')
  })
  it("calendários usam revisão publicada e vigência imutável, sem jornada padrão", () => {
    for (const key of ["ScheduleCalendar_shop_version", "ScheduleCalendar_professional_version", "ScheduleCalendar_current_shop", "ScheduleCalendar_current_professional", "ScheduleCalendar_no_revision_overlap", "ScheduleWeeklyWindow_no_overlap", "ScheduleExceptionWindow_no_overlap"]) expect(a).toContain(`"${key}"`)
    expect(a).toContain('Calendar must be published before commit')
    expect(a).toContain('Calendar snapshots are immutable after publication')
    expect(a).toContain('"scope" = \'SHOP\' AND "professionalId" IS NULL')
    expect(field("ScheduleCalendar", "timezoneSnapshot").isRequired).toBe(true)
    expect(a).toContain('"timezone" = NEW."timezoneSnapshot"')
    expect(a).toContain('pg_timezone_names'); expect(a).not.toContain("America/Cuiaba")
    expect(a).toContain('"validFrom" < "validUntil"')
    expect(a).toContain('Invalid date exception windows')
  })
  it("consistência diferida valida estado final da transação e exige auditoria", () => {
    for (const table of ["Appointment", "AppointmentItem", "AppointmentServiceComponent", "ScheduleEntry", "ScheduleCalendar"]) expect(a).toMatch(new RegExp(`AFTER INSERT(?: OR UPDATE)? ON "${table}" DEFERRABLE INITIALLY DEFERRED`))
    expect(a).toContain('"metadata" ? \'before\' AND "metadata" ? \'after\'')
    expect(a).toContain('coalesce("metadata"->>\'version\',"metadata"->\'after\'->>\'version\') = revision::text')
    expect(a).toContain('Agenda mutation requires its transactional audit')
    expect(a).toContain('FOR NO KEY UPDATE'); expect(a).toContain('FOR UPDATE')
  })
  it("audit identity is database-stamped, immutable, and from the actual transaction", () => {
    const stamp = functions.find(row => row[1] === "agenda_stamp_audit")![2]
    const audit = functions.find(row => row[1] === "agenda_require_audit")![2]
    expect(stamp).toContain("jsonb_set(NEW.\"metadata\",'{_agendaTransactionId}',to_jsonb(pg_current_xact_id()::text))")
    expect(a).toContain('BEFORE INSERT ON "CheckoutAuditEvent" FOR EACH ROW WHEN (NEW."action" LIKE \'agenda.%\')')
    expect(audit).toContain('"metadata"->>\'_agendaTransactionId\' = pg_current_xact_id()::text')
    expect(audit).not.toMatch(/createdAt|transaction_timestamp/)
    const original = readFileSync("prisma/migrations/20261022120000_checkout_pdv_foundation/migration.sql", "utf8")
    expect(original).toContain('BEFORE UPDATE ON "CheckoutAuditEvent" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_mutation"()')
    expect(original).toContain('BEFORE DELETE ON "CheckoutAuditEvent" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"()')
    expect(a).not.toMatch(/DROP TRIGGER/)
  })
  it("audit verifies typed before/after images, not just arbitrary metadata and version", () => {
    const audit = functions.find(row => row[1] === "agenda_require_audit")![2]
    expect(audit).toContain('"agenda_audit_image"(entity_name,evidence."metadata"->\'after\') = expected_after')
    expect(audit).toContain('"agenda_audit_image"(entity_name,evidence."metadata"->\'before\') = expected_before')
    for (const entity of ["Appointment", "AppointmentItem", "AppointmentServiceComponent", "ScheduleEntry", "ScheduleCalendar"]) {
      expect(a).toContain(`jsonb_populate_record(NULL::"${entity}",image)`)
    }
    expect(a).toContain("CASE WHEN TG_OP = 'INSERT' THEN 'null'::jsonb ELSE to_jsonb(OLD) END,to_jsonb(NEW)")
    expect(a).toContain("TG_TABLE_NAME IN ('AppointmentItem','AppointmentServiceComponent')")
    expect(audit).not.toMatch(/saleId/)
  })
  it("start metadata cannot be forged while canceling a never-started appointment", () => {
    expect(a).toContain('ROW(NEW."startedAt",NEW."startedById") IS DISTINCT FROM ROW(OLD."startedAt",OLD."startedById")')
    expect(a).toContain("NOT (OLD.\"status\" IN ('SCHEDULED','CONFIRMED') AND NEW.\"status\" = 'IN_PROGRESS')")
    expect(a).toContain('Start metadata requires attendance start')
  })
  it("historical actor snapshots cannot authorize revoked roles or inactive identities", () => {
    const scope = functions.find(row => row[1] === "agenda_actor_scope")![2]
    expect(scope).toContain('FROM "BarbershopUser" WHERE "barbershopId" = tenant AND "userId" = actor."userId" AND "role" = actor."roleSnapshot" FOR SHARE')
    expect(scope).toContain('"permissionLevel"::text = actor."roleSnapshot"::text')
    expect(scope).toContain('"status" = \'ACTIVE\' AND "userId" IS NULL')
    expect(scope).toContain('Inactive agenda tenant')
    expect(scope).toContain('Agenda actor membership is no longer valid')
  })
})
describe("Agenda B: vínculos e legado do Checkout", () => {
  it("price guard presents a complete SQL CASE to the PL/pgSQL IF reader", () => {
    const guard = functions.find(row => row[1] === "agenda_guard_sale_item_link")![2]
    const condition = guard.slice(guard.indexOf('IF NEW."originalUnitPriceCents"'))
    const expression = ifExpression(condition)
    expect(expression).toContain("CASE")
    expect(expression).toContain("ELSE")
    expect(expression).toContain("SELECT")
    expect(expression.at(-2)).toBe("END")
    expect(expression.at(-1)).toBe(")")
    // Mutation reproduces the exact original failure, not just a missing token
    // count: all CASE/END/THEN tokens still exist, but the IF ends too early.
    const broken = condition.replace("<> (CASE", "<> CASE").replace("END) THEN", "END THEN")
    expect(() => ifExpression(broken)).toThrow("Unfinished SQL CASE at PL/pgSQL IF boundary")
  })
  it("IF regression ignores keywords in quoted text/comments and supports nested CASE", () => {
    expect(ifExpression(`IF "CASE" = 'THEN END CASE' AND (CASE WHEN true THEN (CASE WHEN false THEN 1 ELSE 2 END) ELSE 3 END) /* THEN */ THEN RETURN NEW; END IF;`).at(-1)).toBe(")")
    expect(() => ifExpression("IF value <> CASE WHEN true THEN 1 ELSE 2 END THEN RETURN NEW; END IF;")).toThrow("Unfinished SQL CASE")
    expect(() => ifExpression("IF (CASE WHEN true THEN 1 ELSE 2 END THEN RETURN NEW;")).toThrow("Incomplete IF expression")
  })
  it("diagnostic regions preserve complete dollar-quoted functions without statement splitting", () => {
    const body = b.match(/^\s*BEGIN;([\s\S]*?)COMMIT;\s*$/)![1]
    const markers = [...body.matchAll(/^-- agenda-diagnostic-region: ([a-z0-9_]+)\r?$/gm)]
    expect(markers.map(row => row[1])).toEqual(["01_checkout_links_ddl", "02_agenda_guard_sale_link", "03_agenda_guard_sale_item_link", "04_agenda_assert_completion", "05_agenda_guard_completion_transition", "06_agenda_assert_sale", "07_agenda_deferred_sale"])
    const regions = markers.map((marker, index) => body.slice(index === 0 ? 0 : marker.index, markers[index + 1]?.index ?? body.length))
    expect(regions.join("")).toBe(body)
    for (let index = 1; index < regions.length; index++) {
      const name = markers[index][1].slice(3)
      const wholeFunction = functions.find(fn => fn[1] === name && b.includes(fn[0]))![0]
      expect(regions[index]).toContain(wholeFunction)
      expect(regions[index].match(/CREATE(?: OR REPLACE)? FUNCTION/g)).toHaveLength(1)
    }
  })
  it.each([["Sale", "appointmentId", "Appointment"], ["SaleItem", "appointmentItemId", "AppointmentItem"]])("%s tem relação nullable tenant-safe", (table, column, target) => {
    expect(field(table, column)).toMatchObject({ type: "String", isRequired: false })
    expect(b).toContain(`ALTER TABLE "${table}" ADD COLUMN "${column}" TEXT;`)
    expect(foreignKeys).toContainEqual(expect.arrayContaining([table, target]))
  })
  it("somente uma tentativa PENDING/PAID permanece ativa; outras são históricas", () => {
    expect(b).toContain('CREATE UNIQUE INDEX "Sale_one_active_appointment" ON "Sale"("barbershopId","appointmentId")')
    expect(b).toContain('WHERE "appointmentId" IS NOT NULL AND "status" IN (\'PENDING\',\'PAID\')')
    expect(b).toContain('IF NEW."appointmentId" IS NULL THEN RETURN NEW; END IF;')
    expect(b).toContain('NEW."appointmentId" IS DISTINCT FROM OLD."appointmentId"')
    expect(b).toContain('TG_OP = \'INSERT\' AND (NEW."status" <> \'PENDING\' OR parent."status" <> \'IN_PROGRESS\'')
  })
  it("substitui somente o bloqueio temporário de origem e mantém AGENDA legado", () => {
    expect([...b.matchAll(/DROP CONSTRAINT "([^"]+)"/g)].map(row => row[1])).toEqual(["Sale_origin_phase2_check"])
    expect(b).toContain('"appointmentId" IS NULL OR "origin" = \'AGENDA\'')
    expect(b).toContain('ELSIF NEW."appointmentId" IS NULL AND NEW."origin" = \'AGENDA\'')
    expect(b).not.toMatch(/ADD COLUMN "appointmentId"[^;]*(?:DEFAULT|NOT NULL)/)
    expect(b).not.toMatch(/CREATE OR REPLACE FUNCTION "checkout_/)
  })
  it("item pertence ao mesmo Appointment; preço/duração reservados não vêm do catálogo vigente", () => {
    expect(b).toContain('source."appointmentId" IS DISTINCT FROM parent."appointmentId"')
    expect(b).toContain('NEW."unitPriceCents" <> source."priceCentsSnapshot"')
    expect(b).toContain('NEW."durationMinutesSnapshot" IS DISTINCT FROM source."durationMinutesSnapshot"')
    expect(b).toContain('ac."professionalId" = c."professionalId"')
    expect(b).toContain('ac."priceCentsSnapshot" = c."originalPriceCents"')
    expect(b).not.toMatch(/FROM "(?:Service|ServicePackage|Product)"/)
    expect(b).toContain('IF NEW."appointmentItemId" IS NULL THEN RETURN NEW; END IF;')
  })
  it("conclusão inicial exige PAID, preservando atendimento após cancelamento financeiro", () => {
    expect(a).toContain('Appointment completion requires Checkout integration')
    expect(b).toContain('NEW."status" = \'COMPLETED\' AND OLD."status" <> \'COMPLETED\'')
    expect(b).toContain('"status" = \'PAID\' AND "finalizedAt" IS NOT NULL')
    expect(b).toContain('"status" IN (\'PAID\',\'CANCELED\')')
    expect(b).toContain('(\"finalizedAt\" AT TIME ZONE \'UTC\') <= parent.\"completedAt\"')
    expect(b).toContain('parent."status" = \'PENDING\' AND appointment."status" <> \'IN_PROGRESS\'')
    expect(b).toContain('parent."status" = \'VOIDED\' AND appointment."status" NOT IN (\'IN_PROGRESS\',\'CANCELED\',\'COMPLETED\')')
    expect(b).toContain('AFTER INSERT OR UPDATE ON "Appointment" DEFERRABLE INITIALLY DEFERRED')
  })
  it("paid appointment compatibility rejects omitted reserved items and a changed customer", () => {
    const assertion = functions.find(row => row[1] === "agenda_assert_sale")![2]
    expect(assertion).toContain('parent."customerId" IS DISTINCT FROM appointment."customerId"')
    expect(assertion).toContain('source."appointmentId" = parent."appointmentId" AND source."removedAt" IS NULL')
    expect(assertion).toContain('AND NOT EXISTS (SELECT 1 FROM "SaleItem" i WHERE i."barbershopId" = tenant AND i."saleId" = sale_id AND i."appointmentItemId" = source."id" AND i."removedAt" IS NULL)')
    expect(assertion).toContain('Finalized agenda sale must cover its reserved items and customer')
    expect(b).toContain('Sale_appointment_consistency')
    expect(b).toContain('SaleItem_appointment_consistency')
  })
})
describe("Agenda: integridade dos artefatos", () => {
  it.each(Object.entries(historical))("migration anterior %s permanece intacta", (folder, hash) => {
    expect(createHash("sha256").update(readFileSync(`prisma/migrations/${folder}/migration.sql`, "utf8").replace(/\r\n/g, "\n")).digest("hex")).toBe(hash)
  })
  it("não apaga dados, não faz backfill nem modifica tabelas existentes além dos vínculos", () => {
    expect(sql).not.toMatch(/^\s*(?:DELETE\s+FROM|TRUNCATE|DROP\s+(?:TABLE|TYPE|INDEX)|UPDATE\s+"|INSERT\s+INTO|ALTER TABLE[^;]*DROP COLUMN)/gmi)
    expect(sql).not.toMatch(/ON DELETE CASCADE|ON UPDATE CASCADE/)
    expect(a.match(/^BEGIN;/gm)).toHaveLength(1); expect(a.match(/^COMMIT;/gm)).toHaveLength(1)
    expect(b.match(/^BEGIN;/gm)).toHaveLength(1); expect(b.match(/^COMMIT;/gm)).toHaveLength(1)
  })
  it("nomes não colidem nem são truncados e toda trigger tem função existente", () => {
    const constraints = [...sql.matchAll(/(?:ADD CONSTRAINT|^\s+CONSTRAINT) "([^"]+)"/gm)].map(row => row[1])
    const triggers = [...sql.matchAll(/CREATE(?: CONSTRAINT)? TRIGGER "([^"]+)"[\s\S]*?EXECUTE FUNCTION "([^"]+)"\(\);/g)]
    const objectNames = [...constraints, ...indexes.map(row => row[2]), ...triggers.map(row => row[1])]
    expect(new Set(objectNames).size).toBe(objectNames.length)
    for (const name of objectNames) expect(Buffer.byteLength(name), name).toBeLessThanOrEqual(63)
    for (const row of triggers) expect(functions.some(fn => fn[1] === row[2])).toBe(true)
    for (const row of foreignKeys) {
      expect(model(row[1])).toBeDefined(); expect(model(row[4])).toBeDefined()
      for (const column of quoted(row[3])) expect(field(row[1], column)).toBeDefined()
      for (const column of quoted(row[5])) expect(field(row[4], column)).toBeDefined()
      if (names.includes(row[4])) expect(a.indexOf(`CREATE TABLE "${row[4]}"`)).toBeLessThan(sql.indexOf(row[0]))
    }
    expect(foreignKeys).toHaveLength(34)
    const previous = Object.keys(historical).map(folder => readFileSync(`prisma/migrations/${folder}/migration.sql`, "utf8")).join("\n")
    const oldNames = [...previous.matchAll(/(?:CONSTRAINT|INDEX|TRIGGER|FUNCTION) "([^"]+)"/g)].map(row => row[1])
    for (const name of objectNames) expect(oldNames, name).not.toContain(name)
    const replacements = [...sql.matchAll(/CREATE OR REPLACE FUNCTION "([^"]+)"/g)].map(row => row[1])
    expect(replacements).toEqual(["agenda_assert_completion"])
    expect(functions.filter(row => row[1] === "agenda_assert_completion")).toHaveLength(2)
    expect(sql).not.toMatch(/DROP FUNCTION|DROP TRIGGER/)
  })
})
