-- AlterTable
ALTER TABLE "Professional" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BarbershopUser_barbershopId_userId_key"
ON "BarbershopUser"("barbershopId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_barbershopId_userId_key"
ON "Professional"("barbershopId", "userId");

-- AddForeignKey
ALTER TABLE "Professional"
ADD CONSTRAINT "Professional_barbershopId_userId_fkey"
FOREIGN KEY ("barbershopId", "userId")
REFERENCES "BarbershopUser"("barbershopId", "userId")
ON DELETE RESTRICT ON UPDATE CASCADE;
