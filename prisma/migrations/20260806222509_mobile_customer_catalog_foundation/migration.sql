BEGIN;

CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'BLOCKED');
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Barbershop" ADD COLUMN "slug" TEXT, ADD COLUMN "timezone" TEXT;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Barbershop") <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one barbershop before mobile foundation migration';
  END IF;
END $$;

UPDATE "Barbershop"
SET "slug" = 'mr-dyllan-barbearia', "timezone" = 'America/Cuiaba'
WHERE "name" = 'Mr Dyllan Barbearia';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Barbershop" WHERE "slug" IS NULL OR "timezone" IS NULL) THEN
    RAISE EXCEPTION 'Barbershop public identity backfill was not completed';
  END IF;
  IF EXISTS (SELECT "slug" FROM "Barbershop" GROUP BY "slug" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate barbershop slug detected';
  END IF;
END $$;

ALTER TABLE "Barbershop"
ALTER COLUMN "slug" SET NOT NULL,
ALTER COLUMN "timezone" SET NOT NULL,
ALTER COLUMN "timezone" SET DEFAULT 'America/Cuiaba';

CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BarbershopCustomer" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BarbershopCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Service_priceCents_check" CHECK ("priceCents" >= 0),
    CONSTRAINT "Service_durationMinutes_check" CHECK ("durationMinutes" > 0),
    CONSTRAINT "Service_displayOrder_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "ProfessionalService" (
    "barbershopId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("barbershopId", "professionalId", "serviceId")
);

CREATE UNIQUE INDEX "CustomerAccount_email_key" ON "CustomerAccount"("email");
CREATE INDEX "BarbershopCustomer_barbershopId_status_idx" ON "BarbershopCustomer"("barbershopId", "status");
CREATE INDEX "BarbershopCustomer_customerAccountId_idx" ON "BarbershopCustomer"("customerAccountId");
CREATE UNIQUE INDEX "BarbershopCustomer_barbershopId_customerAccountId_key" ON "BarbershopCustomer"("barbershopId", "customerAccountId");
CREATE INDEX "Service_barbershopId_status_displayOrder_idx" ON "Service"("barbershopId", "status", "displayOrder");
CREATE UNIQUE INDEX "Service_barbershopId_id_key" ON "Service"("barbershopId", "id");
CREATE UNIQUE INDEX "Service_barbershopId_name_key" ON "Service"("barbershopId", "name");
CREATE INDEX "ProfessionalService_barbershopId_serviceId_idx" ON "ProfessionalService"("barbershopId", "serviceId");
CREATE UNIQUE INDEX "Barbershop_slug_key" ON "Barbershop"("slug");
CREATE UNIQUE INDEX "Professional_barbershopId_id_key" ON "Professional"("barbershopId", "id");

ALTER TABLE "Professional" ADD CONSTRAINT "Professional_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BarbershopCustomer" ADD CONSTRAINT "BarbershopCustomer_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BarbershopCustomer" ADD CONSTRAINT "BarbershopCustomer_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_barbershopId_professionalId_fkey" FOREIGN KEY ("barbershopId", "professionalId") REFERENCES "Professional"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_barbershopId_serviceId_fkey" FOREIGN KEY ("barbershopId", "serviceId") REFERENCES "Service"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
