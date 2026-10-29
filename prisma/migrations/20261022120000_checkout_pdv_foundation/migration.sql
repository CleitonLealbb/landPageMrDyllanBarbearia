BEGIN;

-- CreateEnum
CREATE TYPE "CheckoutIdentityType" AS ENUM ('USER', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InventoryMovementKind" AS ENUM ('OPENING', 'ENTRY', 'SALE', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "SaleOrigin" AS ENUM ('WALK_IN', 'AGENDA');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "SaleItemKind" AS ENUM ('SERVICE', 'PACKAGE', 'PRODUCT');

-- CreateEnum
CREATE TYPE "CheckoutDiscountKind" AS ENUM ('NONE', 'MANUAL_FIXED', 'MANUAL_PERCENT', 'COUPON');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CommissionEntryKind" AS ENUM ('EARNED', 'REVERSAL');

-- CreateEnum
CREATE TYPE "CommissionEntryStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementKind" AS ENUM ('OPENING', 'SUPPLY', 'WITHDRAWAL', 'SALE', 'REVERSAL');

-- CreateTable
CREATE TABLE "CheckoutActor" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "identityType" "CheckoutIdentityType" NOT NULL,
    "userId" TEXT,
    "professionalId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "roleSnapshot" "TenantRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutActor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "categoryId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "costCents" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "saleItemId" TEXT,
    "actorId" TEXT NOT NULL,
    "kind" "InventoryMovementKind" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "customerId" TEXT,
    "operatorId" TEXT NOT NULL,
    "canceledById" TEXT,
    "cashSessionId" TEXT,
    "origin" "SaleOrigin" NOT NULL DEFAULT 'WALK_IN',
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "servicesSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "productsSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountKind" "CheckoutDiscountKind" NOT NULL DEFAULT 'NONE',
    "discountBasisPoints" INTEGER,
    "couponCodeSnapshot" TEXT,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "tipCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "kind" "SaleItemKind" NOT NULL,
    "serviceId" TEXT,
    "packageId" TEXT,
    "productId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "originalUnitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleServiceComponent" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "serviceId" TEXT,
    "professionalId" TEXT NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "professionalNameSnapshot" TEXT NOT NULL,
    "unitOrdinal" INTEGER NOT NULL,
    "componentOrdinal" INTEGER NOT NULL,
    "originalPriceCents" INTEGER NOT NULL,
    "allocationWeightCents" INTEGER NOT NULL,
    "allocatedGrossCents" INTEGER NOT NULL,
    "allocatedDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "commissionBaseCents" INTEGER NOT NULL,
    "commissionBasisPoints" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleServiceComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleTip" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "professionalNameSnapshot" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "appliedCents" INTEGER NOT NULL,
    "cashReceivedCents" INTEGER,
    "changeCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" "CommissionEntryKind" NOT NULL,
    "status" "CommissionEntryStatus" NOT NULL DEFAULT 'POSTED',
    "baseCents" INTEGER NOT NULL,
    "basisPoints" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegister" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "shift" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingBalanceCents" INTEGER NOT NULL,
    "expectedBalanceCents" INTEGER,
    "countedBalanceCents" INTEGER,
    "differenceCents" INTEGER,
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "saleId" TEXT,
    "paymentId" TEXT,
    "actorId" TEXT NOT NULL,
    "kind" "CashMovementKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutAuditEvent" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutIdempotency" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "saleId" TEXT,
    "responseStatus" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckoutActor_barbershopId_userId_idx" ON "CheckoutActor"("barbershopId", "userId");

-- CreateIndex
CREATE INDEX "CheckoutActor_barbershopId_professionalId_idx" ON "CheckoutActor"("barbershopId", "professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutActor_barbershopId_id_key" ON "CheckoutActor"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_barbershopId_id_key" ON "ProductCategory"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_barbershopId_name_key" ON "ProductCategory"("barbershopId", "name");

-- CreateIndex
CREATE INDEX "Product_barbershopId_status_name_idx" ON "Product"("barbershopId", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barbershopId_id_key" ON "Product"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barbershopId_sku_key" ON "Product"("barbershopId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barbershopId_barcode_key" ON "Product"("barbershopId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_barbershopId_id_key" ON "InventoryBalance"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_barbershopId_productId_key" ON "InventoryBalance"("barbershopId", "productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_barbershopId_productId_createdAt_idx" ON "InventoryMovement"("barbershopId", "productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_barbershopId_id_key" ON "InventoryMovement"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_barbershopId_reversalOfId_key" ON "InventoryMovement"("barbershopId", "reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_barbershopId_saleItemId_kind_key" ON "InventoryMovement"("barbershopId", "saleItemId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_barbershopId_id_productId_key" ON "InventoryMovement"("barbershopId", "id", "productId");

-- CreateIndex
CREATE INDEX "Sale_barbershopId_status_createdAt_idx" ON "Sale"("barbershopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_barbershopId_customerId_createdAt_idx" ON "Sale"("barbershopId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_barbershopId_operatorId_createdAt_idx" ON "Sale"("barbershopId", "operatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_barbershopId_id_key" ON "Sale"("barbershopId", "id");

-- CreateIndex
CREATE INDEX "SaleItem_barbershopId_saleId_idx" ON "SaleItem"("barbershopId", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_barbershopId_id_key" ON "SaleItem"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_barbershopId_id_saleId_key" ON "SaleItem"("barbershopId", "id", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_barbershopId_id_productId_key" ON "SaleItem"("barbershopId", "id", "productId");

-- CreateIndex
CREATE INDEX "SaleServiceComponent_barbershopId_professionalId_createdAt_idx" ON "SaleServiceComponent"("barbershopId", "professionalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleServiceComponent_barbershopId_id_key" ON "SaleServiceComponent"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SaleServiceComponent_barbershopId_saleItemId_unitOrdinal_co_key" ON "SaleServiceComponent"("barbershopId", "saleItemId", "unitOrdinal", "componentOrdinal");

-- CreateIndex
CREATE UNIQUE INDEX "SaleServiceComponent_barbershopId_id_professionalId_key" ON "SaleServiceComponent"("barbershopId", "id", "professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleTip_barbershopId_id_key" ON "SaleTip"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SaleTip_barbershopId_saleId_professionalId_key" ON "SaleTip"("barbershopId", "saleId", "professionalId");

-- CreateIndex
CREATE INDEX "Payment_barbershopId_method_recordedAt_idx" ON "Payment"("barbershopId", "method", "recordedAt");

-- CreateIndex
CREATE INDEX "Payment_barbershopId_saleId_idx" ON "Payment"("barbershopId", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_barbershopId_id_key" ON "Payment"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_barbershopId_id_saleId_key" ON "Payment"("barbershopId", "id", "saleId");

-- CreateIndex
CREATE INDEX "CommissionEntry_barbershopId_professionalId_status_createdA_idx" ON "CommissionEntry"("barbershopId", "professionalId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_barbershopId_id_key" ON "CommissionEntry"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_barbershopId_reversalOfId_key" ON "CommissionEntry"("barbershopId", "reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_barbershopId_componentId_kind_key" ON "CommissionEntry"("barbershopId", "componentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_barbershopId_id_componentId_professionalId_key" ON "CommissionEntry"("barbershopId", "id", "componentId", "professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegister_barbershopId_id_key" ON "CashRegister"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegister_barbershopId_name_key" ON "CashRegister"("barbershopId", "name");

-- CreateIndex
CREATE INDEX "CashSession_barbershopId_status_openedAt_idx" ON "CashSession"("barbershopId", "status", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_barbershopId_id_key" ON "CashSession"("barbershopId", "id");

-- CreateIndex
CREATE INDEX "CashMovement_barbershopId_cashSessionId_createdAt_idx" ON "CashMovement"("barbershopId", "cashSessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_barbershopId_id_key" ON "CashMovement"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_barbershopId_reversalOfId_key" ON "CashMovement"("barbershopId", "reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_barbershopId_paymentId_kind_key" ON "CashMovement"("barbershopId", "paymentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_barbershopId_id_saleId_paymentId_key" ON "CashMovement"("barbershopId", "id", "saleId", "paymentId");

-- CreateIndex
CREATE INDEX "CheckoutAuditEvent_barbershopId_entity_entityId_createdAt_idx" ON "CheckoutAuditEvent"("barbershopId", "entity", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutAuditEvent_barbershopId_id_key" ON "CheckoutAuditEvent"("barbershopId", "id");

-- CreateIndex
CREATE INDEX "CheckoutIdempotency_barbershopId_createdAt_idx" ON "CheckoutIdempotency"("barbershopId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIdempotency_barbershopId_id_key" ON "CheckoutIdempotency"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIdempotency_barbershopId_operation_key_key" ON "CheckoutIdempotency"("barbershopId", "operation", "key");

-- CreateIndex
CREATE UNIQUE INDEX "BarbershopCustomer_barbershopId_id_key" ON "BarbershopCustomer"("barbershopId", "id");

-- AddForeignKey
ALTER TABLE "CheckoutActor" ADD CONSTRAINT "CheckoutActor_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CheckoutActor" ADD CONSTRAINT "CheckoutActor_barbershopId_userId_fkey" FOREIGN KEY ("barbershopId", "userId") REFERENCES "BarbershopUser"("barbershopId", "userId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CheckoutActor" ADD CONSTRAINT "CheckoutActor_barbershopId_professionalId_fkey" FOREIGN KEY ("barbershopId", "professionalId") REFERENCES "Professional"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_barbershopId_categoryId_fkey" FOREIGN KEY ("barbershopId", "categoryId") REFERENCES "ProductCategory"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_barbershopId_productId_fkey" FOREIGN KEY ("barbershopId", "productId") REFERENCES "Product"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_barbershopId_productId_fkey" FOREIGN KEY ("barbershopId", "productId") REFERENCES "Product"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_barbershopId_saleItemId_productId_fkey" FOREIGN KEY ("barbershopId", "saleItemId", "productId") REFERENCES "SaleItem"("barbershopId", "id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_barbershopId_reversalOfId_productId_fkey" FOREIGN KEY ("barbershopId", "reversalOfId", "productId") REFERENCES "InventoryMovement"("barbershopId", "id", "productId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_barbershopId_actorId_fkey" FOREIGN KEY ("barbershopId", "actorId") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_barbershopId_customerId_fkey" FOREIGN KEY ("barbershopId", "customerId") REFERENCES "BarbershopCustomer"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_barbershopId_cashSessionId_fkey" FOREIGN KEY ("barbershopId", "cashSessionId") REFERENCES "CashSession"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_barbershopId_operatorId_fkey" FOREIGN KEY ("barbershopId", "operatorId") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_barbershopId_canceledById_fkey" FOREIGN KEY ("barbershopId", "canceledById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_barbershopId_saleId_fkey" FOREIGN KEY ("barbershopId", "saleId") REFERENCES "Sale"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_barbershopId_serviceId_fkey" FOREIGN KEY ("barbershopId", "serviceId") REFERENCES "Service"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_barbershopId_packageId_fkey" FOREIGN KEY ("barbershopId", "packageId") REFERENCES "ServicePackage"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_barbershopId_productId_fkey" FOREIGN KEY ("barbershopId", "productId") REFERENCES "Product"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleServiceComponent" ADD CONSTRAINT "SaleServiceComponent_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleServiceComponent" ADD CONSTRAINT "SaleServiceComponent_barbershopId_saleItemId_fkey" FOREIGN KEY ("barbershopId", "saleItemId") REFERENCES "SaleItem"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleServiceComponent" ADD CONSTRAINT "SaleServiceComponent_barbershopId_serviceId_fkey" FOREIGN KEY ("barbershopId", "serviceId") REFERENCES "Service"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleServiceComponent" ADD CONSTRAINT "SaleServiceComponent_barbershopId_professionalId_fkey" FOREIGN KEY ("barbershopId", "professionalId") REFERENCES "Professional"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleTip" ADD CONSTRAINT "SaleTip_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleTip" ADD CONSTRAINT "SaleTip_barbershopId_saleId_fkey" FOREIGN KEY ("barbershopId", "saleId") REFERENCES "Sale"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SaleTip" ADD CONSTRAINT "SaleTip_barbershopId_professionalId_fkey" FOREIGN KEY ("barbershopId", "professionalId") REFERENCES "Professional"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_barbershopId_saleId_fkey" FOREIGN KEY ("barbershopId", "saleId") REFERENCES "Sale"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_barbershopId_actorId_fkey" FOREIGN KEY ("barbershopId", "actorId") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_barbershopId_componentId_professionalId_fkey" FOREIGN KEY ("barbershopId", "componentId", "professionalId") REFERENCES "SaleServiceComponent"("barbershopId", "id", "professionalId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_barbershopId_professionalId_fkey" FOREIGN KEY ("barbershopId", "professionalId") REFERENCES "Professional"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_barbershopId_reversalOfId_componentId_prof_fkey" FOREIGN KEY ("barbershopId", "reversalOfId", "componentId", "professionalId") REFERENCES "CommissionEntry"("barbershopId", "id", "componentId", "professionalId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_barbershopId_actorId_fkey" FOREIGN KEY ("barbershopId", "actorId") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_barbershopId_cashRegisterId_fkey" FOREIGN KEY ("barbershopId", "cashRegisterId") REFERENCES "CashRegister"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_barbershopId_openedById_fkey" FOREIGN KEY ("barbershopId", "openedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_barbershopId_closedById_fkey" FOREIGN KEY ("barbershopId", "closedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_barbershopId_cashSessionId_fkey" FOREIGN KEY ("barbershopId", "cashSessionId") REFERENCES "CashSession"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_barbershopId_saleId_fkey" FOREIGN KEY ("barbershopId", "saleId") REFERENCES "Sale"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_barbershopId_paymentId_saleId_fkey" FOREIGN KEY ("barbershopId", "paymentId", "saleId") REFERENCES "Payment"("barbershopId", "id", "saleId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_barbershopId_reversalOfId_saleId_paymentId_fkey" FOREIGN KEY ("barbershopId", "reversalOfId", "saleId", "paymentId") REFERENCES "CashMovement"("barbershopId", "id", "saleId", "paymentId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_barbershopId_actorId_fkey" FOREIGN KEY ("barbershopId", "actorId") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CheckoutAuditEvent" ADD CONSTRAINT "CheckoutAuditEvent_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CheckoutAuditEvent" ADD CONSTRAINT "CheckoutAuditEvent_barbershopId_actorId_fkey" FOREIGN KEY ("barbershopId", "actorId") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CheckoutIdempotency" ADD CONSTRAINT "CheckoutIdempotency_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CheckoutIdempotency" ADD CONSTRAINT "CheckoutIdempotency_barbershopId_saleId_fkey" FOREIGN KEY ("barbershopId", "saleId") REFERENCES "Sale"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CheckoutIdempotency" ADD CONSTRAINT "CheckoutIdempotency_barbershopId_actorId_fkey" FOREIGN KEY ("barbershopId", "actorId") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Additional PostgreSQL invariants not represented by Prisma's datamodel.
ALTER TABLE "CheckoutActor" ADD CONSTRAINT "CheckoutActor_identity_check" CHECK (
  ("identityType" = 'USER' AND "userId" IS NOT NULL AND "professionalId" IS NULL)
  OR ("identityType" = 'PROFESSIONAL' AND "professionalId" IS NOT NULL AND "userId" IS NULL
      AND "roleSnapshot" IN ('BARBER', 'ASSISTANT'))
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_money_check" CHECK ("priceCents" >= 0 AND ("costCents" IS NULL OR "costCents" >= 0)),
  ADD CONSTRAINT "Product_identifiers_check" CHECK (length(btrim("sku")) > 0 AND ("barcode" IS NULL OR length(btrim("barcode")) > 0));
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_nonnegative_check" CHECK ("quantity" >= 0 AND "version" >= 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_quantity_check" CHECK (
  "quantityDelta" <> 0 AND "quantityDelta" > -2147483648
  AND ("kind" NOT IN ('OPENING', 'ENTRY') OR "quantityDelta" > 0)
  AND ("kind" <> 'SALE' OR ("quantityDelta" < 0 AND "saleItemId" IS NOT NULL))
  AND ("kind" IN ('SALE', 'REVERSAL') OR "saleItemId" IS NULL)
), ADD CONSTRAINT "InventoryMovement_reversal_check" CHECK (
  ("kind" = 'REVERSAL') = ("reversalOfId" IS NOT NULL) AND "reversalOfId" IS DISTINCT FROM "id"
);
CREATE UNIQUE INDEX "InventoryMovement_one_opening_per_product" ON "InventoryMovement"("barbershopId", "productId") WHERE "kind" = 'OPENING';

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_money_check" CHECK (
  "servicesSubtotalCents" >= 0 AND "productsSubtotalCents" >= 0 AND "discountCents" >= 0 AND "tipCents" >= 0 AND "totalCents" >= 0
  AND "discountCents"::bigint <= "servicesSubtotalCents"::bigint + "productsSubtotalCents"::bigint
  AND "totalCents"::bigint = "servicesSubtotalCents"::bigint + "productsSubtotalCents"::bigint - "discountCents"::bigint + "tipCents"::bigint
  AND "version" >= 0
), ADD CONSTRAINT "Sale_discount_check" CHECK (
  ("discountKind" = 'NONE' AND "discountCents" = 0 AND "discountBasisPoints" IS NULL AND "couponCodeSnapshot" IS NULL)
  OR ("discountKind" = 'MANUAL_FIXED' AND "discountBasisPoints" IS NULL AND "couponCodeSnapshot" IS NULL)
  OR ("discountKind" = 'MANUAL_PERCENT' AND "discountBasisPoints" IS NOT NULL AND "discountBasisPoints" BETWEEN 0 AND 10000 AND "couponCodeSnapshot" IS NULL
      AND "discountCents"::bigint = (("servicesSubtotalCents"::bigint + "productsSubtotalCents"::bigint) * "discountBasisPoints"::bigint + 5000) / 10000)
  OR ("discountKind" = 'COUPON' AND "discountBasisPoints" IS NULL AND "couponCodeSnapshot" IS NOT NULL AND length(btrim("couponCodeSnapshot")) > 0)
), ADD CONSTRAINT "Sale_lifecycle_check" CHECK (
  ("status" <> 'PAID' OR ("finalizedAt" IS NOT NULL AND "cashSessionId" IS NOT NULL))
  AND ("finalizedAt" IS NULL OR ("status" IN ('PAID', 'CANCELED') AND "cashSessionId" IS NOT NULL AND "finalizedAt" >= "createdAt"))
  AND (("status" = 'CANCELED' AND "canceledAt" IS NOT NULL AND "canceledById" IS NOT NULL AND "cancellationReason" IS NOT NULL AND length(btrim("cancellationReason")) > 0)
       OR ("status" <> 'CANCELED' AND "canceledAt" IS NULL AND "canceledById" IS NULL AND "cancellationReason" IS NULL))
  AND ("canceledAt" IS NULL OR "canceledAt" >= COALESCE("finalizedAt", "createdAt"))
), ADD CONSTRAINT "Sale_origin_phase2_check" CHECK ("origin" = 'WALK_IN'),
  ADD CONSTRAINT "Sale_coupon_phase2_check" CHECK ("discountKind" <> 'COUPON');

ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_money_check" CHECK (
  "unitPriceCents" >= 0 AND "originalUnitPriceCents" >= 0 AND "quantity" > 0
  AND "subtotalCents"::bigint = "unitPriceCents"::bigint * "quantity"::bigint
  AND "discountCents" >= 0 AND "discountCents" <= "subtotalCents"
  AND "totalCents" = "subtotalCents" - "discountCents"
), ADD CONSTRAINT "SaleItem_catalog_kind_check" CHECK (
  ("kind" = 'SERVICE' AND "packageId" IS NULL AND "productId" IS NULL)
  OR ("kind" = 'PACKAGE' AND "serviceId" IS NULL AND "productId" IS NULL)
  OR ("kind" = 'PRODUCT' AND "serviceId" IS NULL AND "packageId" IS NULL)
);
ALTER TABLE "SaleServiceComponent" ADD CONSTRAINT "SaleServiceComponent_money_check" CHECK (
  "originalPriceCents" >= 0 AND "allocationWeightCents" = "originalPriceCents" AND "allocatedGrossCents" >= 0
  AND "allocatedDiscountCents" >= 0 AND "allocatedDiscountCents" <= "allocatedGrossCents"
  AND "commissionBaseCents" = "allocatedGrossCents" - "allocatedDiscountCents"
  AND "commissionBasisPoints" BETWEEN 0 AND 10000 AND "commissionCents" >= 0
  AND "commissionCents"::bigint = ("commissionBaseCents"::bigint * "commissionBasisPoints"::bigint + 5000) / 10000
  AND "unitOrdinal" > 0 AND "componentOrdinal" > 0
);
ALTER TABLE "SaleTip" ADD CONSTRAINT "SaleTip_positive_check" CHECK ("amountCents" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_money_check" CHECK (
  "appliedCents" > 0 AND "changeCents" >= 0 AND "refundedCents" >= 0 AND "refundedCents" <= "appliedCents"
  AND (("method" = 'CASH' AND "cashReceivedCents" IS NOT NULL AND "cashReceivedCents" >= "appliedCents" AND "changeCents" = "cashReceivedCents" - "appliedCents")
       OR ("method" <> 'CASH' AND "cashReceivedCents" IS NULL AND "changeCents" = 0))
), ADD CONSTRAINT "Payment_refund_check" CHECK (
  ("status" = 'RECORDED' AND "refundedCents" = 0 AND "refundedAt" IS NULL)
  OR ("status" = 'REFUNDED' AND "refundedCents" = "appliedCents" AND "refundedAt" IS NOT NULL AND "refundedAt" >= "recordedAt")
);
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_money_check" CHECK (
  "baseCents" >= 0 AND "basisPoints" BETWEEN 0 AND 10000 AND "amountCents" >= 0
  AND "amountCents"::bigint = ("baseCents"::bigint * "basisPoints"::bigint + 5000) / 10000
), ADD CONSTRAINT "CommissionEntry_reversal_check" CHECK (
  ("kind" = 'REVERSAL') = ("reversalOfId" IS NOT NULL) AND "reversalOfId" IS DISTINCT FROM "id"
  AND ("kind" <> 'REVERSAL' OR "status" = 'POSTED')
);

ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_money_check" CHECK (
  "openingBalanceCents" >= 0 AND "version" >= 0
  AND ("expectedBalanceCents" IS NULL OR "expectedBalanceCents" >= 0)
  AND ("countedBalanceCents" IS NULL OR "countedBalanceCents" >= 0)
), ADD CONSTRAINT "CashSession_lifecycle_check" CHECK (
  ("status" = 'OPEN' AND "closedAt" IS NULL AND "closedById" IS NULL AND "expectedBalanceCents" IS NULL AND "countedBalanceCents" IS NULL AND "differenceCents" IS NULL)
  OR ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL AND "closedAt" >= "openedAt"
      AND "expectedBalanceCents" IS NOT NULL AND "countedBalanceCents" IS NOT NULL AND "differenceCents" IS NOT NULL
      AND "differenceCents"::bigint = "countedBalanceCents"::bigint - "expectedBalanceCents"::bigint)
);
CREATE UNIQUE INDEX "CashSession_one_open_per_register" ON "CashSession"("barbershopId", "cashRegisterId") WHERE "status" = 'OPEN';
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_money_check" CHECK ("amountCents" >= 0 AND ("kind" = 'OPENING' OR "amountCents" > 0)),
  ADD CONSTRAINT "CashMovement_links_check" CHECK (
    (("kind" IN ('SALE', 'REVERSAL') AND "saleId" IS NOT NULL AND "paymentId" IS NOT NULL)
      OR ("kind" NOT IN ('SALE', 'REVERSAL') AND "saleId" IS NULL AND "paymentId" IS NULL))
    AND ("kind" = 'REVERSAL') = ("reversalOfId" IS NOT NULL) AND "reversalOfId" IS DISTINCT FROM "id"
  );
CREATE UNIQUE INDEX "CashMovement_one_opening_per_session" ON "CashMovement"("barbershopId", "cashSessionId") WHERE "kind" = 'OPENING';
ALTER TABLE "CheckoutAuditEvent" ADD CONSTRAINT "CheckoutAuditEvent_metadata_check" CHECK (jsonb_typeof("metadata") = 'object');
ALTER TABLE "CheckoutIdempotency" ADD CONSTRAINT "CheckoutIdempotency_result_check" CHECK (
  length(btrim("operation")) BETWEEN 1 AND 100 AND length(btrim("key")) BETWEEN 1 AND 200
  AND "requestHash" ~ '^[0-9a-f]{64}$' AND "responseStatus" BETWEEN 200 AND 299 AND jsonb_typeof("result") = 'object'
);

-- Preserve financial history even if a future caller attempts a physical removal.
CREATE FUNCTION "checkout_reject_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Checkout records cannot be physically removed' USING ERRCODE = '23514';
END;
$$;
CREATE FUNCTION "checkout_reject_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Checkout ledger records are immutable' USING ERRCODE = '23514';
END;
$$;

-- Reversals must exactly offset an original, never another reversal.
CREATE FUNCTION "checkout_validate_inventory_reversal"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original "InventoryMovement"%ROWTYPE;
BEGIN
  IF NEW."kind" = 'REVERSAL' THEN
    SELECT * INTO original FROM "InventoryMovement" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."reversalOfId";
    IF NOT FOUND OR original."kind" = 'REVERSAL' OR original."productId" <> NEW."productId"
       OR original."saleItemId" IS DISTINCT FROM NEW."saleItemId" OR NEW."quantityDelta"::bigint <> -original."quantityDelta"::bigint THEN
      RAISE EXCEPTION 'Invalid inventory reversal' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InventoryMovement_validate_reversal" BEFORE INSERT ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION "checkout_validate_inventory_reversal"();

CREATE FUNCTION "checkout_validate_commission"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original "CommissionEntry"%ROWTYPE; component "SaleServiceComponent"%ROWTYPE;
BEGIN
  IF NEW."status" <> 'POSTED' THEN
    RAISE EXCEPTION 'New commission entries must be posted' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO component FROM "SaleServiceComponent" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."componentId";
  IF NOT FOUND OR component."professionalId" <> NEW."professionalId" OR component."commissionBaseCents" <> NEW."baseCents"
     OR component."commissionBasisPoints" <> NEW."basisPoints" OR component."commissionCents" <> NEW."amountCents" THEN
    RAISE EXCEPTION 'Commission does not match historical component' USING ERRCODE = '23514';
  END IF;
  IF NEW."kind" = 'REVERSAL' THEN
    SELECT * INTO original FROM "CommissionEntry" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."reversalOfId";
    IF NOT FOUND OR original."kind" <> 'EARNED' OR original."componentId" <> NEW."componentId" OR original."professionalId" <> NEW."professionalId"
       OR original."baseCents" <> NEW."baseCents" OR original."basisPoints" <> NEW."basisPoints" OR original."amountCents" <> NEW."amountCents" THEN
      RAISE EXCEPTION 'Invalid commission reversal' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CommissionEntry_validate_snapshot" BEFORE INSERT ON "CommissionEntry" FOR EACH ROW EXECUTE FUNCTION "checkout_validate_commission"();

CREATE FUNCTION "checkout_validate_cash_movement"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original "CashMovement"%ROWTYPE; payment "Payment"%ROWTYPE; session "CashSession"%ROWTYPE;
BEGIN
  SELECT * INTO session FROM "CashSession" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."cashSessionId" FOR UPDATE;
  IF NOT FOUND OR session."status" <> 'OPEN' THEN
    RAISE EXCEPTION 'Cash session must be open' USING ERRCODE = '23514';
  END IF;
  IF NEW."kind" = 'OPENING' AND NEW."amountCents" <> session."openingBalanceCents" THEN
    RAISE EXCEPTION 'Opening movement must match opening balance' USING ERRCODE = '23514';
  END IF;
  IF NEW."kind" IN ('SALE', 'REVERSAL') THEN
    SELECT * INTO payment FROM "Payment" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."paymentId";
    IF NOT FOUND OR payment."method" <> 'CASH' OR payment."saleId" <> NEW."saleId" OR payment."appliedCents" <> NEW."amountCents" THEN
      RAISE EXCEPTION 'Cash movement must match cash payment' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."kind" = 'REVERSAL' THEN
    SELECT * INTO original FROM "CashMovement" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."reversalOfId";
    IF NOT FOUND OR original."kind" <> 'SALE' OR original."saleId" <> NEW."saleId" OR original."paymentId" <> NEW."paymentId" OR original."amountCents" <> NEW."amountCents" THEN
      RAISE EXCEPTION 'Invalid cash reversal' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CashMovement_validate_links" BEFORE INSERT ON "CashMovement" FOR EACH ROW EXECUTE FUNCTION "checkout_validate_cash_movement"();

-- Structural foundation only: application transactions must reconcile item/component/payment
-- aggregates, lock the open cash session, update stock conditionally, and check permissions.
-- No business API, appointment relation or automatic balance mutation is installed here.

CREATE TRIGGER "CheckoutActor_no_delete" BEFORE DELETE ON "CheckoutActor" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "ProductCategory_no_delete" BEFORE DELETE ON "ProductCategory" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "Product_no_delete" BEFORE DELETE ON "Product" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "InventoryBalance_no_delete" BEFORE DELETE ON "InventoryBalance" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "InventoryMovement_no_delete" BEFORE DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "Sale_no_delete" BEFORE DELETE ON "Sale" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "SaleItem_no_delete" BEFORE DELETE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "SaleServiceComponent_no_delete" BEFORE DELETE ON "SaleServiceComponent" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "SaleTip_no_delete" BEFORE DELETE ON "SaleTip" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "Payment_no_delete" BEFORE DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "CommissionEntry_no_delete" BEFORE DELETE ON "CommissionEntry" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "CashRegister_no_delete" BEFORE DELETE ON "CashRegister" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "CashSession_no_delete" BEFORE DELETE ON "CashSession" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "CashMovement_no_delete" BEFORE DELETE ON "CashMovement" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "CheckoutAuditEvent_no_delete" BEFORE DELETE ON "CheckoutAuditEvent" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "CheckoutIdempotency_no_delete" BEFORE DELETE ON "CheckoutIdempotency" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_delete"();
CREATE TRIGGER "CheckoutActor_immutable" BEFORE UPDATE ON "CheckoutActor" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_mutation"();
CREATE TRIGGER "InventoryMovement_immutable" BEFORE UPDATE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_mutation"();
CREATE TRIGGER "CashMovement_immutable" BEFORE UPDATE ON "CashMovement" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_mutation"();
CREATE TRIGGER "CheckoutAuditEvent_immutable" BEFORE UPDATE ON "CheckoutAuditEvent" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_mutation"();
CREATE TRIGGER "CheckoutIdempotency_immutable" BEFORE UPDATE ON "CheckoutIdempotency" FOR EACH ROW EXECUTE FUNCTION "checkout_reject_mutation"();

-- A paid sale retains its financial snapshots; cancellation only adds metadata.
CREATE FUNCTION "checkout_guard_sale"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session "CashSession"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'CANCELED' THEN
      RAISE EXCEPTION 'Canceled sales are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."finalizedAt" IS NOT NULL THEN
      IF NEW."status" NOT IN ('PAID', 'CANCELED') OR
         (to_jsonb(NEW) - ARRAY['status','canceledAt','canceledById','cancellationReason','version','updatedAt']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['status','canceledAt','canceledById','cancellationReason','version','updatedAt']) THEN
        RAISE EXCEPTION 'Finalized sale snapshots are immutable' USING ERRCODE = '23514';
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
CREATE TRIGGER "Sale_guard_history" BEFORE INSERT OR UPDATE ON "Sale" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_sale"();

CREATE FUNCTION "checkout_guard_item_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Sale"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."barbershopId" <> OLD."barbershopId" OR NEW."saleId" <> OLD."saleId") THEN
    RAISE EXCEPTION 'Cannot reassign sale snapshots' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleId" FOR UPDATE;
  IF NOT FOUND OR parent."finalizedAt" IS NOT NULL OR parent."status" = 'CANCELED' THEN
    RAISE EXCEPTION 'Sale snapshots cannot change after finalization or cancellation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SaleItem_guard_snapshot" BEFORE INSERT OR UPDATE ON "SaleItem" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_item_snapshot"();
CREATE TRIGGER "SaleTip_guard_snapshot" BEFORE INSERT OR UPDATE ON "SaleTip" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_item_snapshot"();

CREATE FUNCTION "checkout_guard_component_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF NOT FOUND OR parent."finalizedAt" IS NOT NULL OR parent."status" = 'CANCELED' THEN
    RAISE EXCEPTION 'Service component snapshots are frozen' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SaleServiceComponent_guard_snapshot" BEFORE INSERT OR UPDATE ON "SaleServiceComponent" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_component_snapshot"();

CREATE FUNCTION "checkout_guard_commission_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') OR
     OLD."kind" <> 'EARNED' OR OLD."status" <> 'POSTED' OR NEW."status" <> 'REVERSED' OR NOT EXISTS (
       SELECT 1 FROM "CommissionEntry" WHERE "barbershopId" = OLD."barbershopId" AND "reversalOfId" = OLD."id" AND "kind" = 'REVERSAL'
     ) THEN
    RAISE EXCEPTION 'Commission snapshots are immutable; append a reversal first' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CommissionEntry_guard_update" BEFORE UPDATE ON "CommissionEntry" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_commission_update"();

CREATE FUNCTION "checkout_guard_payment"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Sale"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - ARRAY['status','refundedCents','refundedAt']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','refundedCents','refundedAt']) OR OLD."status" <> 'RECORDED' OR NEW."status" <> 'REFUNDED' THEN
      RAISE EXCEPTION 'Payment snapshots are immutable; only full refund is supported' USING ERRCODE = '23514';
    END IF;
  END IF;
  SELECT * INTO parent FROM "Sale" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."saleId" FOR UPDATE;
  IF NOT FOUND OR (TG_OP = 'INSERT' AND (parent."finalizedAt" IS NOT NULL OR parent."status" = 'CANCELED'))
     OR (TG_OP = 'UPDATE' AND parent."status" <> 'CANCELED') THEN
    RAISE EXCEPTION 'Payment operation does not match sale lifecycle' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Payment_guard_snapshot" BEFORE INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_payment"();

CREATE FUNCTION "checkout_guard_cash_session"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'CLOSED' OR NEW."barbershopId" <> OLD."barbershopId" OR NEW."cashRegisterId" <> OLD."cashRegisterId"
     OR NEW."openedById" <> OLD."openedById" OR NEW."openingBalanceCents" <> OLD."openingBalanceCents" OR NEW."openedAt" <> OLD."openedAt" THEN
    RAISE EXCEPTION 'Cash session opening and closed sessions are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CashSession_guard_history" BEFORE UPDATE ON "CashSession" FOR EACH ROW EXECUTE FUNCTION "checkout_guard_cash_session"();

COMMIT;
