BEGIN;

CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceCategory_displayOrder_check" CHECK ("displayOrder" >= 0)
);

ALTER TABLE "Service" ADD COLUMN "categoryId" TEXT;

CREATE UNIQUE INDEX "ServiceCategory_barbershopId_id_key" ON "ServiceCategory"("barbershopId", "id");
CREATE UNIQUE INDEX "ServiceCategory_barbershopId_name_key" ON "ServiceCategory"("barbershopId", "name");
CREATE INDEX "ServiceCategory_barbershopId_status_displayOrder_idx" ON "ServiceCategory"("barbershopId", "status", "displayOrder");

ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_barbershopId_categoryId_fkey" FOREIGN KEY ("barbershopId", "categoryId") REFERENCES "ServiceCategory"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
