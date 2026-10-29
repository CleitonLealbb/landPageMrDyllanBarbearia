BEGIN;

-- Null removal metadata means active, including every existing snapshot.
ALTER TABLE "SaleItem" ADD COLUMN "removedAt" TIMESTAMP(3);
ALTER TABLE "SaleItem" ADD COLUMN "removedById" TEXT;
ALTER TABLE "SaleItem" ADD COLUMN "removedReason" TEXT;
ALTER TABLE "SaleTip" ADD COLUMN "removedAt" TIMESTAMP(3);
ALTER TABLE "SaleTip" ADD COLUMN "removedById" TEXT;
ALTER TABLE "SaleTip" ADD COLUMN "removedReason" TEXT;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_barbershopId_removedById_fkey" FOREIGN KEY ("barbershopId", "removedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_removal_check" CHECK (("removedAt" IS NULL AND "removedById" IS NULL AND "removedReason" IS NULL) OR ("removedAt" IS NOT NULL AND "removedById" IS NOT NULL AND "removedReason" IS NOT NULL AND length(btrim("removedReason")) BETWEEN 1 AND 500));
ALTER TABLE "SaleTip" ADD CONSTRAINT "SaleTip_barbershopId_removedById_fkey" FOREIGN KEY ("barbershopId", "removedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "SaleTip" ADD CONSTRAINT "SaleTip_removal_check" CHECK (("removedAt" IS NULL AND "removedById" IS NULL AND "removedReason" IS NULL) OR ("removedAt" IS NOT NULL AND "removedById" IS NOT NULL AND "removedReason" IS NOT NULL AND length(btrim("removedReason")) BETWEEN 1 AND 500));
CREATE INDEX "SaleItem_barbershopId_saleId_removedAt_idx" ON "SaleItem"("barbershopId", "saleId", "removedAt");
CREATE INDEX "SaleItem_barbershopId_removedById_idx" ON "SaleItem"("barbershopId", "removedById");
CREATE INDEX "SaleTip_barbershopId_saleId_removedAt_idx" ON "SaleTip"("barbershopId", "saleId", "removedAt");
CREATE INDEX "SaleTip_barbershopId_removedById_idx" ON "SaleTip"("barbershopId", "removedById");
-- Replace only the index: no historical row or preceding migration is changed.
DROP INDEX "SaleTip_barbershopId_saleId_professionalId_key";
CREATE UNIQUE INDEX "SaleTip_one_active_professional" ON "SaleTip"("barbershopId", "saleId", "professionalId") WHERE "removedAt" IS NULL;

CREATE OR REPLACE FUNCTION "checkout_guard_item_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Sale"%ROWTYPE;
BEGIN
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleId" FOR UPDATE;
  IF NOT FOUND OR parent."finalizedAt" IS NOT NULL OR parent."status" NOT IN ('DRAFT', 'PENDING') THEN
    RAISE EXCEPTION 'Sale snapshots cannot change after closure' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."removedAt" IS NOT NULL OR NEW."removedById" IS NOT NULL OR NEW."removedReason" IS NOT NULL THEN
      RAISE EXCEPTION 'New snapshots must be active' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF parent."status" <> 'PENDING' OR OLD."removedAt" IS NOT NULL OR NEW."removedAt" IS NULL OR
       (to_jsonb(NEW) - ARRAY['removedAt','removedById','removedReason']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['removedAt','removedById','removedReason']) THEN
      RAISE EXCEPTION 'Snapshots can only be retired once without rewriting history' USING ERRCODE = '23514';
    END IF;
  END IF;
  -- Include retired rows: an invalid posting must not be hidden by retirement.
  IF EXISTS (SELECT 1 FROM "Payment" WHERE "barbershopId" = parent."barbershopId" AND "saleId" = parent."id")
    OR EXISTS (SELECT 1 FROM "CashMovement" WHERE "barbershopId" = parent."barbershopId" AND "saleId" = parent."id")
    OR EXISTS (SELECT 1 FROM "InventoryMovement" m JOIN "SaleItem" i ON i."barbershopId" = m."barbershopId" AND i."id" = m."saleItemId" WHERE i."barbershopId" = parent."barbershopId" AND i."saleId" = parent."id")
    OR EXISTS (SELECT 1 FROM "CommissionEntry" e JOIN "SaleServiceComponent" c ON c."barbershopId" = e."barbershopId" AND c."id" = e."componentId" JOIN "SaleItem" i ON i."barbershopId" = c."barbershopId" AND i."id" = c."saleItemId" WHERE i."barbershopId" = parent."barbershopId" AND i."saleId" = parent."id") THEN
    RAISE EXCEPTION 'Pending revisions cannot have financial effects' USING ERRCODE = '23514';
  END IF;
  UPDATE "Sale" SET "version" = "version" WHERE "barbershopId" = parent."barbershopId" AND "id" = parent."id";
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "checkout_guard_component_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Sale"%ROWTYPE; item "SaleItem"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Component snapshots are immutable; replace their pending item' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO item FROM "SaleItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleItemId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid component parent' USING ERRCODE = '23514'; END IF;
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = item."barbershopId" AND "id" = item."saleId" FOR UPDATE;
  IF NOT FOUND OR parent."finalizedAt" IS NOT NULL OR parent."status" NOT IN ('DRAFT', 'PENDING') THEN
    RAISE EXCEPTION 'Service component snapshots are frozen' USING ERRCODE = '23514';
  END IF;
  -- Re-read after obtaining the parent lock, including for READ COMMITTED callers.
  SELECT * INTO item FROM "SaleItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleItemId";
  IF item."removedAt" IS NOT NULL OR item."kind" = 'PRODUCT' OR NEW."unitOrdinal" > item."quantity" OR (item."kind" = 'SERVICE' AND NEW."componentOrdinal" <> 1) THEN
    RAISE EXCEPTION 'Invalid executable service component' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "Payment" WHERE "barbershopId" = parent."barbershopId" AND "saleId" = parent."id")
    OR EXISTS (SELECT 1 FROM "CashMovement" WHERE "barbershopId" = parent."barbershopId" AND "saleId" = parent."id")
    OR EXISTS (SELECT 1 FROM "InventoryMovement" m JOIN "SaleItem" i ON i."barbershopId" = m."barbershopId" AND i."id" = m."saleItemId" WHERE i."barbershopId" = parent."barbershopId" AND i."saleId" = parent."id")
    OR EXISTS (SELECT 1 FROM "CommissionEntry" e JOIN "SaleServiceComponent" c ON c."barbershopId" = e."barbershopId" AND c."id" = e."componentId" JOIN "SaleItem" i ON i."barbershopId" = c."barbershopId" AND i."id" = c."saleItemId" WHERE i."barbershopId" = parent."barbershopId" AND i."saleId" = parent."id") THEN
    RAISE EXCEPTION 'Pending revisions cannot have financial effects' USING ERRCODE = '23514';
  END IF;
  UPDATE "Sale" SET "version" = "version" WHERE "barbershopId" = parent."barbershopId" AND "id" = parent."id";
  RETURN NEW;
END;
$$;

-- Additional guard; the lifecycle/reversal guards installed previously remain intact.
CREATE FUNCTION "checkout_guard_active_financial_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id TEXT; parent "Sale"%ROWTYPE; retired BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'InventoryMovement' THEN
    IF NEW."saleItemId" IS NULL THEN RETURN NEW; END IF;
    SELECT "saleId" INTO parent_id FROM "SaleItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleItemId";
  ELSE
    SELECT i."saleId" INTO parent_id FROM "SaleServiceComponent" c JOIN "SaleItem" i ON i."barbershopId" = c."barbershopId" AND i."id" = c."saleItemId" WHERE c."barbershopId" = NEW."barbershopId" AND c."id" = NEW."componentId";
  END IF;
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "id" = parent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid financial snapshot' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'InventoryMovement' THEN
    SELECT "removedAt" IS NOT NULL INTO retired FROM "SaleItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleItemId";
  ELSE
    SELECT i."removedAt" IS NOT NULL INTO retired FROM "SaleServiceComponent" c JOIN "SaleItem" i ON i."barbershopId" = c."barbershopId" AND i."id" = c."saleItemId" WHERE c."barbershopId" = NEW."barbershopId" AND c."id" = NEW."componentId";
  END IF;
  IF retired IS DISTINCT FROM FALSE THEN RAISE EXCEPTION 'Retired snapshots cannot produce financial effects' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InventoryMovement_guard_active_snapshot" BEFORE INSERT ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_active_financial_snapshot"();
CREATE TRIGGER "CommissionEntry_guard_active_snapshot" BEFORE INSERT ON "CommissionEntry" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_active_financial_snapshot"();

COMMIT;
