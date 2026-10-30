BEGIN;
-- agenda-diagnostic-region: 01_checkout_links_ddl
-- Nullable links preserve every legacy row, including unlinked AGENDA sales.
-- No backfill, default, UPDATE, financial rewrite or old migration modification.
-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "appointmentId" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "appointmentItemId" TEXT;

-- Replace the temporary phase-2 WALK_IN-only restriction, not any money or
-- lifecycle guard. New AGENDA inserts require a real tenant-safe link below;
-- unlinked legacy origins remain untouched. No financial row is rewritten.
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_origin_phase2_check";
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_appointment_origin_check" CHECK ("appointmentId" IS NULL OR "origin" = 'AGENDA');

-- CreateIndex
CREATE INDEX "Sale_barbershopId_appointmentId_idx" ON "Sale"("barbershopId", "appointmentId");

-- CreateIndex
CREATE INDEX "SaleItem_barbershopId_appointmentItemId_idx" ON "SaleItem"("barbershopId", "appointmentItemId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_barbershopId_appointmentId_fkey" FOREIGN KEY ("barbershopId", "appointmentId") REFERENCES "Appointment"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_barbershopId_appointmentItemId_fkey" FOREIGN KEY ("barbershopId", "appointmentItemId") REFERENCES "AppointmentItem"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "Sale_one_active_appointment" ON "Sale"("barbershopId","appointmentId")
  WHERE "appointmentId" IS NOT NULL AND "status" IN ('PENDING','PAID');
CREATE UNIQUE INDEX "SaleItem_one_active_appointment_item" ON "SaleItem"("barbershopId","saleId","appointmentItemId")
  WHERE "appointmentItemId" IS NOT NULL AND "removedAt" IS NULL;

-- agenda-diagnostic-region: 02_agenda_guard_sale_link
CREATE FUNCTION "agenda_guard_sale_link"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Appointment"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."appointmentId" IS DISTINCT FROM OLD."appointmentId" OR NEW."origin" <> OLD."origin" THEN
      RAISE EXCEPTION 'Sale agenda provenance is immutable' USING ERRCODE = '23514'; END IF;
  ELSIF NEW."appointmentId" IS NULL AND NEW."origin" = 'AGENDA' THEN
    RAISE EXCEPTION 'New agenda sales require an appointment' USING ERRCODE = '23514';
  END IF;
  -- Explicitly preserve old AGENDA rows with no link. Their ordinary financial
  -- lifecycle keeps working under the unmodified Checkout guards.
  IF NEW."appointmentId" IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO parent FROM "Appointment" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."appointmentId" FOR UPDATE;
  IF NOT FOUND OR NEW."origin" <> 'AGENDA' THEN RAISE EXCEPTION 'Invalid tenant appointment link' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' AND (NEW."status" <> 'PENDING' OR parent."status" <> 'IN_PROGRESS' OR NEW."customerId" IS DISTINCT FROM parent."customerId") THEN
    RAISE EXCEPTION 'Start appointment before creating its pending sale' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Sale_guard_appointment_link" BEFORE INSERT OR UPDATE ON "Sale" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_sale_link"();

-- agenda-diagnostic-region: 03_agenda_guard_sale_item_link
CREATE FUNCTION "agenda_guard_sale_item_link"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source "AppointmentItem"%ROWTYPE; parent "Sale"%ROWTYPE;
BEGIN
  IF NEW."appointmentItemId" IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleId" FOR UPDATE;
  SELECT * INTO source FROM "AppointmentItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."appointmentItemId";
  IF NOT FOUND OR source."appointmentId" IS DISTINCT FROM parent."appointmentId" OR parent."appointmentId" IS NULL OR
     NEW."kind"::text <> source."kind"::text OR NEW."nameSnapshot" <> source."nameSnapshot" OR NEW."unitPriceCents" <> source."priceCentsSnapshot" OR
     NEW."durationMinutesSnapshot" IS DISTINCT FROM source."durationMinutesSnapshot" OR NEW."quantity" <> source."quantity" OR
     NEW."serviceId" IS DISTINCT FROM source."serviceId" OR NEW."packageId" IS DISTINCT FROM source."packageId" THEN
    RAISE EXCEPTION 'Sale must preserve its tenant appointment item snapshots' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' AND source."removedAt" IS NOT NULL THEN RAISE EXCEPTION 'Retired appointment item cannot be sold' USING ERRCODE = '23514'; END IF;
  IF NEW."originalUnitPriceCents" <> (CASE WHEN source."kind" = 'SERVICE' THEN source."priceCentsSnapshot" ELSE
     (SELECT sum("priceCentsSnapshot") FROM "AppointmentServiceComponent" WHERE "barbershopId" = source."barbershopId" AND "appointmentItemId" = source."id") END) THEN
    RAISE EXCEPTION 'Invalid reserved original price snapshot' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SaleItem_guard_appointment_link" BEFORE INSERT OR UPDATE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_sale_item_link"();

-- Historical financial cancellation must not undo a completed attendance.
-- agenda-diagnostic-region: 04_agenda_assert_completion
CREATE OR REPLACE FUNCTION "agenda_assert_completion"(tenant TEXT, appointment_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE parent "Appointment"%ROWTYPE;
BEGIN
  SELECT * INTO parent FROM "Appointment" WHERE "barbershopId" = tenant AND "id" = appointment_id;
  IF NOT EXISTS (SELECT 1 FROM "Sale" WHERE "barbershopId" = tenant AND "appointmentId" = appointment_id AND "status" IN ('PAID','CANCELED')
      AND "finalizedAt" IS NOT NULL AND ("finalizedAt" AT TIME ZONE 'UTC') <= parent."completedAt" AND ("finalizedAt" AT TIME ZONE 'UTC') >= parent."startedAt") THEN
    RAISE EXCEPTION 'Completed appointment requires finalized Checkout sale history' USING ERRCODE = '23514'; END IF;
END;
$$;
-- agenda-diagnostic-region: 05_agenda_guard_completion_transition
CREATE FUNCTION "agenda_guard_completion_transition"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'COMPLETED' AND OLD."status" <> 'COMPLETED' AND NOT EXISTS (
    SELECT 1 FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "appointmentId" = NEW."id" AND "status" = 'PAID' AND "finalizedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Only valid paid Checkout finalization may complete attendance' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Appointment_guard_completion" BEFORE UPDATE ON "Appointment" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_completion_transition"();

-- agenda-diagnostic-region: 06_agenda_assert_sale
CREATE FUNCTION "agenda_assert_sale"(tenant TEXT, sale_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE parent "Sale"%ROWTYPE; appointment "Appointment"%ROWTYPE;
BEGIN
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = tenant AND "id" = sale_id;
  IF parent."appointmentId" IS NULL THEN RETURN; END IF;
  SELECT * INTO appointment FROM "Appointment" WHERE "barbershopId" = tenant AND "id" = parent."appointmentId";
  IF NOT FOUND OR (parent."status" = 'PENDING' AND appointment."status" <> 'IN_PROGRESS') OR
    (parent."status" IN ('PAID','CANCELED') AND appointment."status" <> 'COMPLETED') OR
    (parent."status" = 'VOIDED' AND appointment."status" NOT IN ('IN_PROGRESS','CANCELED','COMPLETED')) OR parent."status" = 'DRAFT' THEN
    RAISE EXCEPTION 'Invalid final appointment and sale state' USING ERRCODE = '23514'; END IF;
  IF parent."status" IN ('PAID','CANCELED') THEN
    PERFORM "agenda_assert_completion"(tenant,parent."appointmentId");
    IF parent."customerId" IS DISTINCT FROM appointment."customerId" OR EXISTS (
      SELECT 1 FROM "AppointmentItem" source WHERE source."barbershopId" = tenant AND source."appointmentId" = parent."appointmentId" AND source."removedAt" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "SaleItem" i WHERE i."barbershopId" = tenant AND i."saleId" = sale_id AND i."appointmentItemId" = source."id" AND i."removedAt" IS NULL)) THEN
      RAISE EXCEPTION 'Finalized agenda sale must cover its reserved items and customer' USING ERRCODE = '23514';
    END IF;
  END IF;
  -- Unit ordinals duplicate immutable reserved components when quantity > 1.
  -- Never look up catalog price/duration here: those may legitimately change.
  IF EXISTS (SELECT 1 FROM "SaleItem" i JOIN "AppointmentItem" source ON source."barbershopId" = i."barbershopId" AND source."id" = i."appointmentItemId"
    WHERE i."barbershopId" = tenant AND i."saleId" = sale_id AND i."removedAt" IS NULL AND (
      source."appointmentId" <> parent."appointmentId" OR
      (SELECT count(*) FROM "SaleServiceComponent" c WHERE c."barbershopId" = tenant AND c."saleItemId" = i."id") <>
        i."quantity"::bigint * (SELECT count(*) FROM "AppointmentServiceComponent" ac WHERE ac."barbershopId" = tenant AND ac."appointmentItemId" = source."id") OR
      EXISTS (SELECT 1 FROM "SaleServiceComponent" c WHERE c."barbershopId" = tenant AND c."saleItemId" = i."id" AND NOT EXISTS (
        SELECT 1 FROM "AppointmentServiceComponent" ac WHERE ac."barbershopId" = tenant AND ac."appointmentItemId" = source."id" AND ac."ordinal" = c."componentOrdinal"
          AND ac."serviceId" = c."serviceId" AND ac."professionalId" = c."professionalId" AND ac."serviceNameSnapshot" = c."serviceNameSnapshot"
          AND ac."professionalNameSnapshot" = c."professionalNameSnapshot" AND ac."durationMinutesSnapshot" = c."durationMinutesSnapshot"
          AND ac."priceCentsSnapshot" = c."originalPriceCents" AND ac."priceCentsSnapshot" = c."allocationWeightCents")))) THEN
    RAISE EXCEPTION 'Reserved component snapshots must be preserved' USING ERRCODE = '23514'; END IF;
END;
$$;
-- agenda-diagnostic-region: 07_agenda_deferred_sale
CREATE FUNCTION "agenda_deferred_sale"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sale_id TEXT; linked RECORD;
BEGIN
  IF TG_TABLE_NAME = 'Appointment' THEN
    FOR linked IN SELECT "id" FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "appointmentId" = NEW."id" LOOP
      PERFORM "agenda_assert_sale"(NEW."barbershopId",linked."id");
    END LOOP;
  ELSE
    IF TG_TABLE_NAME = 'Sale' THEN sale_id := NEW."id";
    ELSIF TG_TABLE_NAME = 'SaleItem' THEN sale_id := NEW."saleId";
    ELSE SELECT "saleId" INTO sale_id FROM "SaleItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleItemId"; END IF;
    PERFORM "agenda_assert_sale"(NEW."barbershopId",sale_id);
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Sale_appointment_consistency" AFTER INSERT OR UPDATE ON "Sale" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "agenda_deferred_sale"();
CREATE CONSTRAINT TRIGGER "SaleItem_appointment_consistency" AFTER INSERT OR UPDATE ON "SaleItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "agenda_deferred_sale"();
CREATE CONSTRAINT TRIGGER "SaleComponent_appointment_consistency" AFTER INSERT ON "SaleServiceComponent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "agenda_deferred_sale"();
CREATE CONSTRAINT TRIGGER "Appointment_sale_consistency" AFTER INSERT OR UPDATE ON "Appointment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "agenda_deferred_sale"();

COMMIT;

