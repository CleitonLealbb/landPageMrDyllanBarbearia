BEGIN;

CREATE TABLE "ServicePackage" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServicePackage_priceCents_check" CHECK ("priceCents" >= 0),
    CONSTRAINT "ServicePackage_displayOrder_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "ServicePackageItem" (
    "barbershopId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ServicePackageItem_pkey" PRIMARY KEY ("barbershopId", "packageId", "serviceId"),
    CONSTRAINT "ServicePackageItem_displayOrder_check" CHECK ("displayOrder" >= 0)
);

CREATE UNIQUE INDEX "ServicePackage_barbershopId_id_key" ON "ServicePackage"("barbershopId", "id");
CREATE UNIQUE INDEX "ServicePackage_barbershopId_name_key" ON "ServicePackage"("barbershopId", "name");
CREATE INDEX "ServicePackage_barbershopId_status_displayOrder_idx" ON "ServicePackage"("barbershopId", "status", "displayOrder");
CREATE INDEX "ServicePackageItem_barbershopId_serviceId_idx" ON "ServicePackageItem"("barbershopId", "serviceId");

ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_barbershopId_packageId_fkey"
FOREIGN KEY ("barbershopId", "packageId") REFERENCES "ServicePackage"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_barbershopId_serviceId_fkey"
FOREIGN KEY ("barbershopId", "serviceId") REFERENCES "Service"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
