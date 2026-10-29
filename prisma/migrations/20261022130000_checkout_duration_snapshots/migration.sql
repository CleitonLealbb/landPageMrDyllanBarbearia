BEGIN;

-- Nullable for unknown historical durations; new checkout writes validate them.
ALTER TABLE "SaleItem" ADD COLUMN "durationMinutesSnapshot" INTEGER;
ALTER TABLE "SaleServiceComponent" ADD COLUMN "durationMinutesSnapshot" INTEGER;

ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_duration_snapshot_check"
  CHECK ("durationMinutesSnapshot" IS NULL OR ("durationMinutesSnapshot" > 0 AND "kind" <> 'PRODUCT'));
ALTER TABLE "SaleServiceComponent" ADD CONSTRAINT "SaleServiceComponent_duration_snapshot_check"
  CHECK ("durationMinutesSnapshot" IS NULL OR "durationMinutesSnapshot" > 0);

-- Existing row-wide snapshot triggers protect these columns without replacement.
COMMIT;
