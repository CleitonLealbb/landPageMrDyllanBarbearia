BEGIN;

-- The preceding enum-only migration must have committed before this file runs.
-- Historical CANCELED rows without finalizedAt remain untouched and immutable.
ALTER TABLE "Sale" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "voidedById" TEXT;
ALTER TABLE "Sale" ADD COLUMN "voidReason" TEXT;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_barbershopId_voidedById_fkey" FOREIGN KEY ("barbershopId", "voidedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "Sale_barbershopId_status_voidedAt_idx" ON "Sale"("barbershopId", "status", "voidedAt");
CREATE INDEX "Sale_barbershopId_voidedById_idx" ON "Sale"("barbershopId", "voidedById");

-- The original lifecycle check continues protecting cancellation metadata,
-- including legacy cancellations. Only VOIDED owns these new metadata fields.
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_void_lifecycle_check" CHECK (
  ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND "voidReason" IS NOT NULL
    AND "voidedAt" >= "createdAt"
    AND length("voidReason") BETWEEN 1 AND 500
    AND "voidReason" = btrim(regexp_replace("voidReason", '[[:space:]]+', ' ', 'g'))
    AND "finalizedAt" IS NULL AND "canceledAt" IS NULL AND "canceledById" IS NULL AND "cancellationReason" IS NULL)
  OR ("status" <> 'VOIDED' AND "voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
);

CREATE OR REPLACE FUNCTION "checkout_guard_sale"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session "CashSession"%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" NOT IN ('DRAFT', 'PENDING') OR NEW."finalizedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Sales must be created before finalization' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF OLD."status" IN ('CANCELED', 'VOIDED') THEN
      RAISE EXCEPTION 'Closed sales are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."barbershopId" <> OLD."barbershopId" OR NEW."id" <> OLD."id" THEN
      RAISE EXCEPTION 'Cannot reassign sale identity' USING ERRCODE = '23514';
    END IF;
    IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
      (OLD."status" = 'PENDING' AND NEW."status" IN ('PAID', 'VOIDED'))
      OR (OLD."status" = 'PAID' AND NEW."status" = 'CANCELED')
    ) THEN
      RAISE EXCEPTION 'Invalid sale lifecycle transition' USING ERRCODE = '23514';
    END IF;
    IF OLD."finalizedAt" IS NOT NULL THEN
      IF NEW."status" NOT IN ('PAID', 'CANCELED') OR
         (to_jsonb(NEW) - ARRAY['status','canceledAt','canceledById','cancellationReason','version','updatedAt']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['status','canceledAt','canceledById','cancellationReason','version','updatedAt']) THEN
        RAISE EXCEPTION 'Finalized sale snapshots are immutable' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW."status" = 'CANCELED' AND (OLD."status" <> 'PAID' OR OLD."finalizedAt" IS NULL) THEN
      RAISE EXCEPTION 'Only finalized paid sales can be canceled' USING ERRCODE = '23514';
    END IF;
    IF NEW."status" = 'VOIDED' THEN
      IF OLD."status" <> 'PENDING' OR OLD."finalizedAt" IS NOT NULL OR
         (to_jsonb(NEW) - ARRAY['status','voidedAt','voidedById','voidReason','version','updatedAt']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['status','voidedAt','voidedById','voidReason','version','updatedAt']) THEN
        RAISE EXCEPTION 'Only unchanged pending snapshots can be voided' USING ERRCODE = '23514';
      END IF;
      -- UPDATE already holds the parent sale row lock. Every financial INSERT
      -- below acquires the same lock, including rows reached through items.
      IF EXISTS (SELECT 1 FROM "Payment" WHERE "barbershopId" = NEW."barbershopId" AND "saleId" = NEW."id")
        OR EXISTS (SELECT 1 FROM "CashMovement" WHERE "barbershopId" = NEW."barbershopId" AND "saleId" = NEW."id")
        OR EXISTS (
          SELECT 1 FROM "InventoryMovement" movement
          JOIN "SaleItem" item ON item."barbershopId" = movement."barbershopId" AND item."id" = movement."saleItemId"
          WHERE item."barbershopId" = NEW."barbershopId" AND item."saleId" = NEW."id"
        ) OR EXISTS (
          SELECT 1 FROM "CommissionEntry" entry
          JOIN "SaleServiceComponent" component ON component."barbershopId" = entry."barbershopId" AND component."id" = entry."componentId"
          JOIN "SaleItem" item ON item."barbershopId" = component."barbershopId" AND item."id" = component."saleItemId"
          WHERE item."barbershopId" = NEW."barbershopId" AND item."saleId" = NEW."id"
        ) THEN
        RAISE EXCEPTION 'A voided order cannot have financial effects' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  IF NEW."status" = 'PAID' THEN
    SELECT * INTO session FROM "CashSession" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."cashSessionId" FOR UPDATE;
    IF NOT FOUND OR session."status" <> 'OPEN' THEN
      RAISE EXCEPTION 'An open cash session is required to finalize' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Keep row-wide snapshot guards, including durationMinutesSnapshot from 2B.
CREATE OR REPLACE FUNCTION "checkout_guard_item_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Sale"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."barbershopId" <> OLD."barbershopId" OR NEW."saleId" <> OLD."saleId") THEN
    RAISE EXCEPTION 'Cannot reassign sale snapshots' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleId" FOR UPDATE;
  IF NOT FOUND OR parent."finalizedAt" IS NOT NULL OR parent."status" NOT IN ('DRAFT', 'PENDING') THEN
    RAISE EXCEPTION 'Sale snapshots cannot change after closure' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "checkout_guard_component_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Sale"%ROWTYPE; item "SaleItem"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."barbershopId" <> OLD."barbershopId" OR NEW."saleItemId" <> OLD."saleItemId") THEN
    RAISE EXCEPTION 'Cannot reassign service components' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO item FROM "SaleItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleItemId";
  IF NOT FOUND OR item."kind" = 'PRODUCT' OR NEW."unitOrdinal" > item."quantity" OR (item."kind" = 'SERVICE' AND NEW."componentOrdinal" <> 1) THEN
    RAISE EXCEPTION 'Invalid executable service component' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "id" = item."saleId" FOR UPDATE;
  IF NOT FOUND OR parent."finalizedAt" IS NOT NULL OR parent."status" NOT IN ('DRAFT', 'PENDING') THEN
    RAISE EXCEPTION 'Service component snapshots are frozen' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "checkout_guard_payment"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Sale"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - ARRAY['status','refundedCents','refundedAt']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','refundedCents','refundedAt']) OR OLD."status" <> 'RECORDED' OR NEW."status" <> 'REFUNDED' THEN
      RAISE EXCEPTION 'Payment snapshots are immutable; only full refund is supported' USING ERRCODE = '23514';
    END IF;
  END IF;
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleId" FOR UPDATE;
  IF NOT FOUND OR (TG_OP = 'INSERT' AND (parent."finalizedAt" IS NOT NULL OR parent."status" <> 'PENDING'))
     OR (TG_OP = 'UPDATE' AND (parent."status" <> 'CANCELED' OR parent."finalizedAt" IS NULL)) THEN
    RAISE EXCEPTION 'Payment operation does not match sale lifecycle' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- A row lock alone does not invalidate an older Serializable snapshot when
    -- the concurrent writer uses READ COMMITTED. Create an MVCC row version
    -- without changing the domain version, timestamps or financial snapshots.
    UPDATE "Sale" SET "version" = "version"
      WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleId" AND "status" = 'PENDING';
  END IF;
  RETURN NEW;
END;
$$;

-- Financial INSERTs lock the sale too: a check only at VOIDED transition would
-- leave a race where a later ledger insert could attach to a discarded order.
-- Do not require PAID before stock/payments/cash SALE: finalization creates
-- these while PENDING, then marks PAID and posts commissions in the same tx.
CREATE FUNCTION "checkout_guard_sale_financial_effect"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Sale"%ROWTYPE; parent_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'InventoryMovement' THEN
    IF NEW."saleItemId" IS NULL THEN RETURN NEW; END IF;
    SELECT "saleId" INTO parent_id FROM "SaleItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleItemId";
  ELSIF TG_TABLE_NAME = 'CommissionEntry' THEN
    SELECT item."saleId" INTO parent_id FROM "SaleServiceComponent" component
    JOIN "SaleItem" item ON item."barbershopId" = component."barbershopId" AND item."id" = component."saleItemId"
    WHERE component."barbershopId" = NEW."barbershopId" AND component."id" = NEW."componentId";
  ELSIF TG_TABLE_NAME = 'CashMovement' THEN
    IF NEW."saleId" IS NULL THEN RETURN NEW; END IF;
    -- Preserve cash -> sale lock order even if trigger ordering changes.
    PERFORM 1 FROM "CashSession" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."cashSessionId" FOR UPDATE;
    parent_id := NEW."saleId";
  ELSE
    RAISE EXCEPTION 'Unsupported financial ledger' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "id" = parent_id FOR UPDATE;
  IF NOT FOUND OR parent."status" IN ('DRAFT', 'VOIDED') THEN
    RAISE EXCEPTION 'Financial effects require an eligible sale' USING ERRCODE = '23514';
  END IF;
  IF NEW."kind" = 'REVERSAL' THEN
    IF parent."status" <> 'CANCELED' OR parent."finalizedAt" IS NULL THEN
      RAISE EXCEPTION 'A financial reversal requires a canceled paid sale' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'CommissionEntry' THEN
    IF NEW."kind" <> 'EARNED' OR parent."status" <> 'PAID' OR parent."finalizedAt" IS NULL THEN
      RAISE EXCEPTION 'Commission posting requires a paid sale' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."kind" <> 'SALE' OR parent."status" <> 'PENDING' OR parent."finalizedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'A sale posting must precede finalization' USING ERRCODE = '23514';
  END IF;
  IF parent."status" = 'PENDING' THEN
    -- Pair the ledger write with an MVCC write to its already locked parent.
    -- A Serializable void with an older snapshot must then abort, even when
    -- this ledger writer uses READ COMMITTED. expectedVersion stays unchanged.
    UPDATE "Sale" SET "version" = "version"
      WHERE "barbershopId" = NEW."barbershopId" AND "id" = parent_id AND "status" = 'PENDING';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "InventoryMovement_guard_sale_lifecycle" BEFORE INSERT ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_sale_financial_effect"();
CREATE TRIGGER "CommissionEntry_guard_sale_lifecycle" BEFORE INSERT ON "CommissionEntry" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_sale_financial_effect"();
CREATE TRIGGER "CashMovement_guard_sale_lifecycle" BEFORE INSERT ON "CashMovement" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_sale_financial_effect"();

COMMIT;
