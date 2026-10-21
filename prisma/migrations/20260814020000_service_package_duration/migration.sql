BEGIN;

ALTER TABLE "ServicePackage"
ADD COLUMN "durationMinutes" INTEGER;

UPDATE "ServicePackage" AS package
SET "durationMinutes" = totals."durationMinutes"
FROM (
    SELECT item."packageId", item."barbershopId", SUM(service."durationMinutes")::INTEGER AS "durationMinutes"
    FROM "ServicePackageItem" AS item
    INNER JOIN "Service" AS service
      ON service."barbershopId" = item."barbershopId"
     AND service."id" = item."serviceId"
    GROUP BY item."packageId", item."barbershopId"
) AS totals
WHERE package."id" = totals."packageId"
  AND package."barbershopId" = totals."barbershopId";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "ServicePackage"
        WHERE "durationMinutes" IS NULL OR "durationMinutes" <= 0
    ) THEN
        RAISE EXCEPTION 'Nao foi possivel derivar uma duracao positiva para todos os combos existentes.';
    END IF;
END $$;

ALTER TABLE "ServicePackage"
ALTER COLUMN "durationMinutes" SET NOT NULL;

ALTER TABLE "ServicePackage"
ADD CONSTRAINT "ServicePackage_durationMinutes_check"
CHECK ("durationMinutes" > 0);

COMMIT;
