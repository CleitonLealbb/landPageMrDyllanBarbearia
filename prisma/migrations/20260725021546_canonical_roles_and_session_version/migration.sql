-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('BARBERSHOP_OWNER', 'BARBER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ProfessionalPermissionLevel" AS ENUM ('BARBER', 'ASSISTANT');

-- AlterTable
ALTER TABLE "BarbershopUser"
ALTER COLUMN "role" TYPE "TenantRole"
USING ("role"::text::"TenantRole");

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "permissionLevel" TYPE "ProfessionalPermissionLevel"
USING ("permissionLevel"::text::"ProfessionalPermissionLevel"),
ALTER COLUMN "permissionLevel" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;
