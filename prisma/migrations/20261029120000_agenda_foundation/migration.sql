BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AppointmentOrigin" AS ENUM ('ADMIN', 'MOBILE', 'PUBLIC_WEB', 'WALK_IN');

-- CreateEnum
CREATE TYPE "AppointmentItemKind" AS ENUM ('SERVICE', 'PACKAGE');

-- CreateEnum
CREATE TYPE "ScheduleEntryKind" AS ENUM ('APPOINTMENT', 'BLOCK');

-- CreateEnum
CREATE TYPE "ScheduleBlockReason" AS ENUM ('LUNCH', 'ABSENCE', 'PERSONAL', 'MAINTENANCE', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ScheduleCalendarScope" AS ENUM ('SHOP', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "ScheduleExceptionKind" AS ENUM ('CLOSED', 'REPLACE_WINDOWS');

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerNameSnapshot" TEXT NOT NULL,
    "customerContactSnapshot" TEXT,
    "professionalNameSnapshot" TEXT NOT NULL,
    "timezoneSnapshot" TEXT NOT NULL,
    "origin" "AppointmentOrigin" NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "plannedDurationMinutes" INTEGER NOT NULL,
    "adjustedDurationMinutes" INTEGER,
    "durationAdjustmentReason" TEXT,
    "durationAdjustedById" TEXT,
    "internalNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "startedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "canceledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "cancellationOrigin" "AppointmentOrigin",
    "noShowAt" TIMESTAMPTZ(3),
    "noShowReason" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentItem" (
    "componentCountSnapshot" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT,
    "packageId" TEXT,
    "kind" "AppointmentItemKind" NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "professionalNameSnapshot" TEXT NOT NULL,
    "priceCentsSnapshot" INTEGER NOT NULL,
    "durationMinutesSnapshot" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "removedById" TEXT,
    "removedAt" TIMESTAMPTZ(3),
    "removedReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentServiceComponent" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "appointmentItemId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "professionalNameSnapshot" TEXT NOT NULL,
    "priceCentsSnapshot" INTEGER NOT NULL,
    "durationMinutesSnapshot" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentServiceComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "version" INTEGER NOT NULL DEFAULT 0,
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "kind" "ScheduleEntryKind" NOT NULL,
    "blockReason" "ScheduleBlockReason",
    "reason" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMPTZ(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleCalendar" (
    "timezoneSnapshot" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "professionalId" TEXT,
    "scope" "ScheduleCalendarScope" NOT NULL,
    "version" INTEGER NOT NULL,
    "changeReason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "supersededById" TEXT,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ScheduleCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleWeeklyWindow" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE,

    CONSTRAINT "ScheduleWeeklyWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDateException" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "ScheduleExceptionKind" NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "ScheduleDateException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleExceptionWindow" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "ScheduleExceptionWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_barbershopId_professionalId_status_idx" ON "Appointment"("barbershopId", "professionalId", "status");

-- CreateIndex
CREATE INDEX "Appointment_barbershopId_customerId_createdAt_idx" ON "Appointment"("barbershopId", "customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_barbershopId_id_key" ON "Appointment"("barbershopId", "id");

-- CreateIndex
CREATE INDEX "AppointmentItem_barbershopId_appointmentId_removedAt_idx" ON "AppointmentItem"("barbershopId", "appointmentId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentItem_barbershopId_id_key" ON "AppointmentItem"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentItem_barbershopId_id_professionalId_key" ON "AppointmentItem"("barbershopId", "id", "professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentServiceComponent_barbershopId_id_key" ON "AppointmentServiceComponent"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentServiceComponent_barbershopId_appointmentItemId__key" ON "AppointmentServiceComponent"("barbershopId", "appointmentItemId", "ordinal");

-- CreateIndex
CREATE INDEX "ScheduleEntry_barbershopId_professionalId_startsAt_idx" ON "ScheduleEntry"("barbershopId", "professionalId", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduleEntry_barbershopId_appointmentId_idx" ON "ScheduleEntry"("barbershopId", "appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_barbershopId_id_key" ON "ScheduleEntry"("barbershopId", "id");

-- CreateIndex
CREATE INDEX "ScheduleCalendar_barbershopId_professionalId_effectiveFrom_idx" ON "ScheduleCalendar"("barbershopId", "professionalId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleCalendar_barbershopId_id_key" ON "ScheduleCalendar"("barbershopId", "id");

-- CreateIndex
CREATE INDEX "ScheduleWeeklyWindow_barbershopId_calendarId_weekday_idx" ON "ScheduleWeeklyWindow"("barbershopId", "calendarId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleWeeklyWindow_barbershopId_id_key" ON "ScheduleWeeklyWindow"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDateException_barbershopId_id_key" ON "ScheduleDateException"("barbershopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDateException_barbershopId_calendarId_date_key" ON "ScheduleDateException"("barbershopId", "calendarId", "date");

-- CreateIndex
CREATE INDEX "ScheduleExceptionWindow_barbershopId_exceptionId_idx" ON "ScheduleExceptionWindow"("barbershopId", "exceptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleExceptionWindow_barbershopId_id_key" ON "ScheduleExceptionWindow"("barbershopId", "id");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barbershopId_professionalId_fkey" FOREIGN KEY ("barbershopId", "professionalId") REFERENCES "Professional"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barbershopId_customerId_fkey" FOREIGN KEY ("barbershopId", "customerId") REFERENCES "BarbershopCustomer"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barbershopId_createdById_fkey" FOREIGN KEY ("barbershopId", "createdById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barbershopId_updatedById_fkey" FOREIGN KEY ("barbershopId", "updatedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barbershopId_startedById_fkey" FOREIGN KEY ("barbershopId", "startedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_barbershopId_durationAdjustedById_fkey" FOREIGN KEY ("barbershopId", "durationAdjustedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_barbershopId_appointmentId_fkey" FOREIGN KEY ("barbershopId", "appointmentId") REFERENCES "Appointment"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_barbershopId_professionalId_fkey" FOREIGN KEY ("barbershopId", "professionalId") REFERENCES "Professional"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_barbershopId_serviceId_fkey" FOREIGN KEY ("barbershopId", "serviceId") REFERENCES "Service"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_barbershopId_packageId_fkey" FOREIGN KEY ("barbershopId", "packageId") REFERENCES "ServicePackage"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_barbershopId_createdById_fkey" FOREIGN KEY ("barbershopId", "createdById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_barbershopId_removedById_fkey" FOREIGN KEY ("barbershopId", "removedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentServiceComponent" ADD CONSTRAINT "AppointmentServiceComponent_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentServiceComponent" ADD CONSTRAINT "AppointmentServiceComponent_barbershopId_appointmentItemId_fkey" FOREIGN KEY ("barbershopId", "appointmentItemId", "professionalId") REFERENCES "AppointmentItem"("barbershopId", "id", "professionalId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AppointmentServiceComponent" ADD CONSTRAINT "AppointmentServiceComponent_barbershopId_serviceId_fkey" FOREIGN KEY ("barbershopId", "serviceId") REFERENCES "Service"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_barbershopId_professionalId_fkey" FOREIGN KEY ("barbershopId", "professionalId") REFERENCES "Professional"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_barbershopId_appointmentId_fkey" FOREIGN KEY ("barbershopId", "appointmentId") REFERENCES "Appointment"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_barbershopId_createdById_fkey" FOREIGN KEY ("barbershopId", "createdById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_barbershopId_releasedById_fkey" FOREIGN KEY ("barbershopId", "releasedById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleCalendar" ADD CONSTRAINT "ScheduleCalendar_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleCalendar" ADD CONSTRAINT "ScheduleCalendar_barbershopId_professionalId_fkey" FOREIGN KEY ("barbershopId", "professionalId") REFERENCES "Professional"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleCalendar" ADD CONSTRAINT "ScheduleCalendar_barbershopId_createdById_fkey" FOREIGN KEY ("barbershopId", "createdById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleCalendar" ADD CONSTRAINT "ScheduleCalendar_barbershopId_supersededById_fkey" FOREIGN KEY ("barbershopId", "supersededById") REFERENCES "CheckoutActor"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleWeeklyWindow" ADD CONSTRAINT "ScheduleWeeklyWindow_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleWeeklyWindow" ADD CONSTRAINT "ScheduleWeeklyWindow_barbershopId_calendarId_fkey" FOREIGN KEY ("barbershopId", "calendarId") REFERENCES "ScheduleCalendar"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleDateException" ADD CONSTRAINT "ScheduleDateException_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleDateException" ADD CONSTRAINT "ScheduleDateException_barbershopId_calendarId_fkey" FOREIGN KEY ("barbershopId", "calendarId") REFERENCES "ScheduleCalendar"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleExceptionWindow" ADD CONSTRAINT "ScheduleExceptionWindow_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ScheduleExceptionWindow" ADD CONSTRAINT "ScheduleExceptionWindow_barbershopId_exceptionId_fkey" FOREIGN KEY ("barbershopId", "exceptionId") REFERENCES "ScheduleDateException"("barbershopId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Local dates/minutes describe wall-clock opening windows. All operational
-- instants use timestamptz; no existing Checkout timestamp is converted.
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_snapshot_check" CHECK (
  length(btrim("customerNameSnapshot")) BETWEEN 1 AND 200 AND
  length(btrim("professionalNameSnapshot")) BETWEEN 1 AND 200 AND
  length("timezoneSnapshot") BETWEEN 1 AND 100 AND "version" >= 0 AND
  "plannedDurationMinutes" > 0 AND isfinite("createdAt") AND isfinite("updatedAt") AND
  ("customerContactSnapshot" IS NULL OR length(btrim("customerContactSnapshot")) BETWEEN 1 AND 100) AND
  ("internalNotes" IS NULL OR length("internalNotes") <= 2000));
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_duration_adjustment_check" CHECK (
  ("adjustedDurationMinutes" IS NULL AND "durationAdjustmentReason" IS NULL AND "durationAdjustedById" IS NULL) OR
  ("adjustedDurationMinutes" IS NOT NULL AND "adjustedDurationMinutes" > 0 AND "durationAdjustmentReason" IS NOT NULL AND
   length(btrim("durationAdjustmentReason")) BETWEEN 1 AND 500 AND "durationAdjustedById" IS NOT NULL));
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_lifecycle_check" CHECK (
  (("startedAt" IS NULL AND "startedById" IS NULL) OR ("startedAt" IS NOT NULL AND isfinite("startedAt") AND "startedAt" >= "createdAt" AND "startedById" IS NOT NULL)) AND
  ("status" NOT IN ('IN_PROGRESS','COMPLETED') OR "startedAt" IS NOT NULL) AND
  ("status" NOT IN ('SCHEDULED','CONFIRMED','NO_SHOW') OR "startedAt" IS NULL) AND
  (("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND isfinite("completedAt") AND "completedAt" >= "startedAt") OR ("status" <> 'COMPLETED' AND "completedAt" IS NULL)) AND
  (("status" = 'CANCELED' AND "canceledAt" IS NOT NULL AND isfinite("canceledAt") AND "canceledAt" >= "createdAt" AND "cancellationOrigin" IS NOT NULL AND "cancellationReason" IS NOT NULL AND length(btrim("cancellationReason")) BETWEEN 1 AND 500) OR
   ("status" <> 'CANCELED' AND "canceledAt" IS NULL AND "cancellationOrigin" IS NULL AND "cancellationReason" IS NULL)) AND
  (("status" = 'NO_SHOW' AND "noShowAt" IS NOT NULL AND isfinite("noShowAt") AND "noShowAt" >= "createdAt" AND "noShowReason" IS NOT NULL AND length(btrim("noShowReason")) BETWEEN 1 AND 500) OR
   ("status" <> 'NO_SHOW' AND "noShowAt" IS NULL AND "noShowReason" IS NULL)));
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_snapshot_check" CHECK (
  "priceCentsSnapshot" >= 0 AND "durationMinutesSnapshot" > 0 AND "quantity" BETWEEN 1 AND 100 AND "ordinal" > 0 AND
  (("kind" = 'SERVICE' AND "componentCountSnapshot" = 1) OR ("kind" = 'PACKAGE' AND "componentCountSnapshot" BETWEEN 2 AND 50)) AND
  length(btrim("nameSnapshot")) BETWEEN 1 AND 200 AND length(btrim("professionalNameSnapshot")) BETWEEN 1 AND 200 AND
  (("kind" = 'SERVICE' AND "serviceId" IS NOT NULL AND "packageId" IS NULL) OR ("kind" = 'PACKAGE' AND "packageId" IS NOT NULL AND "serviceId" IS NULL)));
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_removal_check" CHECK (
  ("removedAt" IS NULL AND "removedById" IS NULL AND "removedReason" IS NULL) OR
  ("removedAt" IS NOT NULL AND isfinite("removedAt") AND "removedAt" >= "createdAt" AND "removedById" IS NOT NULL AND "removedReason" IS NOT NULL AND length(btrim("removedReason")) BETWEEN 1 AND 500));
ALTER TABLE "AppointmentServiceComponent" ADD CONSTRAINT "AppointmentComponent_snapshot_check" CHECK (
  "priceCentsSnapshot" >= 0 AND "durationMinutesSnapshot" > 0 AND "ordinal" > 0 AND
  length(btrim("serviceNameSnapshot")) BETWEEN 1 AND 200 AND length(btrim("professionalNameSnapshot")) BETWEEN 1 AND 200);
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_interval_check" CHECK (
  isfinite("startsAt") AND isfinite("endsAt") AND "startsAt" < "endsAt" AND "version" >= 0);
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_kind_check" CHECK (
  ("kind" = 'APPOINTMENT' AND "appointmentId" IS NOT NULL AND "blockReason" IS NULL AND "reason" IS NULL) OR
  ("kind" = 'BLOCK' AND "appointmentId" IS NULL AND "blockReason" IS NOT NULL AND "reason" IS NOT NULL AND length(btrim("reason")) BETWEEN 1 AND 500));
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_release_check" CHECK (
  ("releasedAt" IS NULL AND "releasedById" IS NULL AND "releaseReason" IS NULL) OR
  ("releasedAt" IS NOT NULL AND isfinite("releasedAt") AND "releasedAt" >= "createdAt" AND "releasedById" IS NOT NULL AND "releaseReason" IS NOT NULL AND length(btrim("releaseReason")) BETWEEN 1 AND 500));
ALTER TABLE "ScheduleCalendar" ADD CONSTRAINT "ScheduleCalendar_revision_check" CHECK (
  "version" > 0 AND length(btrim("changeReason")) BETWEEN 1 AND 500 AND
  (("scope" = 'SHOP' AND "professionalId" IS NULL) OR ("scope" = 'PROFESSIONAL' AND "professionalId" IS NOT NULL)) AND
  isfinite("effectiveFrom") AND ("publishedAt" IS NULL OR (isfinite("publishedAt") AND "publishedAt" >= "effectiveFrom")) AND
  (("effectiveUntil" IS NULL AND "supersededById" IS NULL) OR ("effectiveUntil" IS NOT NULL AND isfinite("effectiveUntil") AND "effectiveUntil" > "effectiveFrom" AND "supersededById" IS NOT NULL AND "publishedAt" IS NOT NULL AND "effectiveUntil" >= "publishedAt")));
ALTER TABLE "ScheduleWeeklyWindow" ADD CONSTRAINT "ScheduleWeeklyWindow_bounds_check" CHECK (
  "weekday" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute" AND
  isfinite("validFrom") AND ("validUntil" IS NULL OR (isfinite("validUntil") AND "validFrom" < "validUntil")));
ALTER TABLE "ScheduleDateException" ADD CONSTRAINT "ScheduleDateException_reason_check" CHECK (isfinite("date") AND length(btrim("reason")) BETWEEN 1 AND 500);
ALTER TABLE "ScheduleExceptionWindow" ADD CONSTRAINT "ScheduleExceptionWindow_bounds_check" CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");

CREATE UNIQUE INDEX "AppointmentItem_one_active_ordinal" ON "AppointmentItem"("barbershopId","appointmentId","ordinal") WHERE "removedAt" IS NULL;
CREATE UNIQUE INDEX "AppointmentComponent_one_service" ON "AppointmentServiceComponent"("barbershopId","appointmentItemId","serviceId");
CREATE UNIQUE INDEX "ScheduleEntry_one_active_appointment" ON "ScheduleEntry"("barbershopId","appointmentId") WHERE "appointmentId" IS NOT NULL AND "releasedAt" IS NULL;
CREATE UNIQUE INDEX "ScheduleCalendar_shop_version" ON "ScheduleCalendar"("barbershopId","version") WHERE "scope" = 'SHOP';
CREATE UNIQUE INDEX "ScheduleCalendar_professional_version" ON "ScheduleCalendar"("barbershopId","professionalId","version") WHERE "scope" = 'PROFESSIONAL';
CREATE UNIQUE INDEX "ScheduleCalendar_current_shop" ON "ScheduleCalendar"("barbershopId") WHERE "scope" = 'SHOP' AND "effectiveUntil" IS NULL;
CREATE UNIQUE INDEX "ScheduleCalendar_current_professional" ON "ScheduleCalendar"("barbershopId","professionalId") WHERE "scope" = 'PROFESSIONAL' AND "effectiveUntil" IS NULL;

-- One physical resource table makes exclusion cover appointment/block and
-- block/block races as well as appointment/appointment. Adjacent ends may touch.
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_no_overlap" EXCLUDE USING gist (
  "barbershopId" WITH =, "professionalId" WITH =, (tstzrange("startsAt","endsAt",'[)')) WITH &&
) WHERE ("releasedAt" IS NULL);
ALTER TABLE "ScheduleCalendar" ADD CONSTRAINT "ScheduleCalendar_no_revision_overlap" EXCLUDE USING gist (
  "barbershopId" WITH =, "scope" WITH =, (coalesce("professionalId",'')) WITH =,
  (tstzrange("effectiveFrom","effectiveUntil",'[)')) WITH &&);
ALTER TABLE "ScheduleWeeklyWindow" ADD CONSTRAINT "ScheduleWeeklyWindow_no_overlap" EXCLUDE USING gist (
  "barbershopId" WITH =, "calendarId" WITH =, "weekday" WITH =,
  (daterange("validFrom","validUntil",'[)')) WITH &&, (int4range("startMinute","endMinute",'[)')) WITH &&);
ALTER TABLE "ScheduleExceptionWindow" ADD CONSTRAINT "ScheduleExceptionWindow_no_overlap" EXCLUDE USING gist (
  "barbershopId" WITH =, "exceptionId" WITH =, (int4range("startMinute","endMinute",'[)')) WITH &&);

CREATE FUNCTION "agenda_reject_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Agenda history is immutable' USING ERRCODE = '23514'; END;
$$;

CREATE FUNCTION "agenda_actor_scope"(tenant TEXT, actor_id TEXT, professional_id TEXT, owner_only BOOLEAN DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actor "CheckoutActor"%ROWTYPE; own_id TEXT;
BEGIN
  SELECT * INTO actor FROM "CheckoutActor" WHERE "barbershopId" = tenant AND "id" = actor_id;
  IF NOT FOUND OR (owner_only AND actor."roleSnapshot" <> 'BARBERSHOP_OWNER') THEN
    RAISE EXCEPTION 'Unauthorized agenda actor' USING ERRCODE = '23514';
  END IF;
  -- CheckoutActor is historical evidence, never a permanent authorization grant.
  IF NOT EXISTS (SELECT 1 FROM "Barbershop" WHERE "id" = tenant AND "status" = 'ACTIVE') THEN
    RAISE EXCEPTION 'Inactive agenda tenant' USING ERRCODE = '23514'; END IF;
  IF actor."identityType" = 'USER' THEN
    PERFORM 1 FROM "BarbershopUser" WHERE "barbershopId" = tenant AND "userId" = actor."userId" AND "role" = actor."roleSnapshot" FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Agenda actor membership is no longer valid' USING ERRCODE = '23514'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM "Professional" WHERE "barbershopId" = tenant AND "id" = actor."professionalId" AND "status" = 'ACTIVE' AND "userId" IS NULL AND "permissionLevel"::text = actor."roleSnapshot"::text) THEN
    RAISE EXCEPTION 'Agenda professional identity is no longer valid' USING ERRCODE = '23514';
  END IF;
  IF actor."roleSnapshot" = 'BARBER' THEN
    IF actor."identityType" = 'PROFESSIONAL' THEN own_id := actor."professionalId";
    ELSE SELECT "id" INTO own_id FROM "Professional" WHERE "barbershopId" = tenant AND "userId" = actor."userId" AND "status" = 'ACTIVE'; END IF;
    IF own_id IS DISTINCT FROM professional_id THEN RAISE EXCEPTION 'Invalid own agenda scope' USING ERRCODE = '23514'; END IF;
  END IF;
END;
$$;

-- A is independently safe: completion stays disabled until migration B installs
-- the checker against actual finalized sales. No placeholder Sale is required.
CREATE FUNCTION "agenda_assert_completion"(tenant TEXT, appointment_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Appointment completion requires Checkout integration' USING ERRCODE = '23514'; END;
$$;

CREATE FUNCTION "agenda_guard_appointment"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE role "TenantRole"; professional "Professional"%ROWTYPE;
BEGIN
  PERFORM "agenda_actor_scope"(NEW."barbershopId",NEW."updatedById",NEW."professionalId");
  SELECT "roleSnapshot" INTO role FROM "CheckoutActor" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."updatedById";
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'SCHEDULED' OR NEW."version" <> 0 OR NEW."createdById" <> NEW."updatedById" OR role = 'BARBER' OR NEW."origin" NOT IN ('ADMIN','WALK_IN') THEN
      RAISE EXCEPTION 'Invalid initial appointment' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "Barbershop" WHERE "id" = NEW."barbershopId" AND "status" = 'ACTIVE' AND "timezone" = NEW."timezoneSnapshot") OR
       NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW."timezoneSnapshot") THEN RAISE EXCEPTION 'Invalid shop timezone' USING ERRCODE = '23514'; END IF;
  ELSE
    IF OLD."status" IN ('COMPLETED','CANCELED','NO_SHOW') OR NEW."id" <> OLD."id" OR NEW."barbershopId" <> OLD."barbershopId" OR
       NEW."origin" <> OLD."origin" OR NEW."createdAt" <> OLD."createdAt" OR NEW."createdById" <> OLD."createdById" OR NEW."timezoneSnapshot" <> OLD."timezoneSnapshot" OR NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION 'Invalid appointment revision' USING ERRCODE = '23514';
    END IF;
    IF NEW."status" <> OLD."status" AND NOT (
      (OLD."status" = 'SCHEDULED' AND NEW."status" IN ('CONFIRMED','IN_PROGRESS','CANCELED','NO_SHOW')) OR
      (OLD."status" = 'CONFIRMED' AND NEW."status" IN ('IN_PROGRESS','CANCELED','NO_SHOW')) OR
      (OLD."status" = 'IN_PROGRESS' AND NEW."status" IN ('COMPLETED','CANCELED'))) THEN RAISE EXCEPTION 'Invalid appointment transition' USING ERRCODE = '23514'; END IF;
    IF ROW(NEW."startedAt",NEW."startedById") IS DISTINCT FROM ROW(OLD."startedAt",OLD."startedById") AND
       NOT (OLD."status" IN ('SCHEDULED','CONFIRMED') AND NEW."status" = 'IN_PROGRESS') THEN
      RAISE EXCEPTION 'Start metadata requires attendance start' USING ERRCODE = '23514';
    END IF;
    IF OLD."status" = 'IN_PROGRESS' AND
       (to_jsonb(NEW) - ARRAY['status','version','updatedAt','updatedById','completedAt','canceledAt','cancellationReason','cancellationOrigin']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','version','updatedAt','updatedById','completedAt','canceledAt','cancellationReason','cancellationOrigin']) THEN
      RAISE EXCEPTION 'Started appointment snapshots are frozen' USING ERRCODE = '23514'; END IF;
    IF role = 'BARBER' AND (NEW."status" NOT IN ('CONFIRMED','IN_PROGRESS','COMPLETED') OR
       (to_jsonb(NEW) - ARRAY['status','version','updatedAt','updatedById','startedAt','startedById','completedAt']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','version','updatedAt','updatedById','startedAt','startedById','completedAt'])) THEN
      RAISE EXCEPTION 'Barber may only confirm or start own appointments' USING ERRCODE = '23514'; END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW."professionalId" IS DISTINCT FROM OLD."professionalId" OR (NEW."status" = 'IN_PROGRESS' AND OLD."status" <> 'IN_PROGRESS') THEN
    SELECT * INTO professional FROM "Professional" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."professionalId" FOR UPDATE;
    IF NOT FOUND OR professional."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'Professional must be active' USING ERRCODE = '23514'; END IF;
    IF (TG_OP = 'INSERT' OR NEW."professionalId" IS DISTINCT FROM OLD."professionalId") AND NEW."professionalNameSnapshot" <> professional."name" THEN RAISE EXCEPTION 'Invalid professional snapshot' USING ERRCODE = '23514'; END IF;
    IF NEW."status" = 'IN_PROGRESS' AND EXISTS (
      SELECT 1 FROM "AppointmentItem" i JOIN "AppointmentServiceComponent" c ON c."barbershopId" = i."barbershopId" AND c."appointmentItemId" = i."id"
      WHERE i."barbershopId" = NEW."barbershopId" AND i."appointmentId" = NEW."id" AND i."removedAt" IS NULL AND NOT EXISTS (
        SELECT 1 FROM "ProfessionalService" ps JOIN "Service" s ON s."barbershopId" = ps."barbershopId" AND s."id" = ps."serviceId"
        WHERE ps."barbershopId" = NEW."barbershopId" AND ps."professionalId" = NEW."professionalId" AND ps."serviceId" = c."serviceId" AND s."status" = 'ACTIVE')) THEN
      RAISE EXCEPTION 'Professional must remain enabled before attendance starts' USING ERRCODE = '23514'; END IF;
  END IF;
  IF NEW."customerId" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."customerId" IS DISTINCT FROM OLD."customerId") AND
     NOT EXISTS (SELECT 1 FROM "BarbershopCustomer" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."customerId" AND "status" = 'ACTIVE') THEN
    RAISE EXCEPTION 'Invalid tenant customer' USING ERRCODE = '23514'; END IF;
  IF (TG_OP = 'INSERT' AND NEW."adjustedDurationMinutes" IS NOT NULL) OR (TG_OP = 'UPDATE' AND ROW(NEW."adjustedDurationMinutes",NEW."durationAdjustmentReason",NEW."durationAdjustedById") IS DISTINCT FROM ROW(OLD."adjustedDurationMinutes",OLD."durationAdjustmentReason",OLD."durationAdjustedById")) THEN
    PERFORM "agenda_actor_scope"(NEW."barbershopId",NEW."updatedById",NEW."professionalId",true);
    IF NEW."adjustedDurationMinutes" IS NOT NULL AND NEW."durationAdjustedById" <> NEW."updatedById" THEN RAISE EXCEPTION 'Invalid duration author' USING ERRCODE = '23514'; END IF;
  END IF;
  IF NEW."status" = 'IN_PROGRESS' AND NEW."startedById" <> NEW."updatedById" AND (TG_OP = 'INSERT' OR OLD."status" <> 'IN_PROGRESS') THEN RAISE EXCEPTION 'Invalid start author' USING ERRCODE = '23514'; END IF;
  -- Validate the CURRENT reservation before releasing it. An older reschedule
  -- entry must never permit a no-show before the new scheduled start.
  IF NEW."status" = 'NO_SHOW' AND NOT EXISTS (SELECT 1 FROM "ScheduleEntry" WHERE "barbershopId" = NEW."barbershopId" AND "appointmentId" = NEW."id" AND "releasedAt" IS NULL AND "startsAt" <= NEW."noShowAt") THEN
    RAISE EXCEPTION 'No-show cannot precede scheduled start' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Appointment_guard" BEFORE INSERT OR UPDATE ON "Appointment" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_appointment"();

CREATE FUNCTION "agenda_guard_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Appointment"%ROWTYPE; item "AppointmentItem"%ROWTYPE; parent_id TEXT; catalog "Service"%ROWTYPE; pack "ServicePackage"%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME = 'AppointmentItem' THEN parent_id := NEW."appointmentId";
  ELSE
    SELECT * INTO item FROM "AppointmentItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."appointmentItemId";
    IF NOT FOUND OR item."removedAt" IS NOT NULL THEN RAISE EXCEPTION 'Invalid component parent' USING ERRCODE = '23514'; END IF;
    parent_id := item."appointmentId";
  END IF;
  SELECT * INTO parent FROM "Appointment" WHERE "barbershopId" = NEW."barbershopId" AND "id" = parent_id FOR UPDATE;
  IF NOT FOUND OR parent."status" NOT IN ('SCHEDULED','CONFIRMED') THEN RAISE EXCEPTION 'Appointment snapshots are frozen' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME <> 'AppointmentItem' OR OLD."removedAt" IS NOT NULL OR NEW."removedAt" IS NULL OR
       (to_jsonb(NEW) - ARRAY['removedAt','removedById','removedReason']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['removedAt','removedById','removedReason']) THEN
      RAISE EXCEPTION 'Snapshots can only be retired once' USING ERRCODE = '23514'; END IF;
    IF NEW."removedById" <> parent."updatedById" THEN RAISE EXCEPTION 'Invalid retirement author' USING ERRCODE = '23514'; END IF;
  ELSE
    IF NEW."professionalId" <> parent."professionalId" OR NOT EXISTS (SELECT 1 FROM "Professional" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."professionalId" AND "status" = 'ACTIVE') THEN
      RAISE EXCEPTION 'All active components require the appointment professional' USING ERRCODE = '23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Professional" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."professionalId" AND "name" = NEW."professionalNameSnapshot") THEN RAISE EXCEPTION 'Invalid professional name snapshot' USING ERRCODE = '23514'; END IF;
    IF TG_TABLE_NAME = 'AppointmentItem' THEN
      IF NEW."removedAt" IS NOT NULL OR NEW."createdById" <> parent."updatedById" THEN RAISE EXCEPTION 'Invalid initial snapshot' USING ERRCODE = '23514'; END IF;
      IF NEW."kind" = 'SERVICE' AND NOT EXISTS (SELECT 1 FROM "Service" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."serviceId" AND "status" = 'ACTIVE') THEN RAISE EXCEPTION 'Inactive service' USING ERRCODE = '23514'; END IF;
      IF NEW."kind" = 'PACKAGE' AND NOT EXISTS (SELECT 1 FROM "ServicePackage" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."packageId" AND "status" = 'ACTIVE') THEN RAISE EXCEPTION 'Inactive package' USING ERRCODE = '23514'; END IF;
      IF NEW."kind" = 'SERVICE' THEN
        SELECT * INTO catalog FROM "Service" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."serviceId";
        IF ROW(NEW."nameSnapshot",NEW."priceCentsSnapshot",NEW."durationMinutesSnapshot") IS DISTINCT FROM ROW(catalog."name",catalog."priceCents",catalog."durationMinutes") THEN RAISE EXCEPTION 'Invalid original service snapshot' USING ERRCODE = '23514'; END IF;
      ELSE
        SELECT * INTO pack FROM "ServicePackage" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."packageId";
        IF ROW(NEW."nameSnapshot",NEW."priceCentsSnapshot",NEW."durationMinutesSnapshot") IS DISTINCT FROM ROW(pack."name",pack."priceCents",pack."durationMinutes") OR
           NEW."componentCountSnapshot" <> (SELECT count(*) FROM "ServicePackageItem" WHERE "barbershopId" = NEW."barbershopId" AND "packageId" = NEW."packageId") THEN RAISE EXCEPTION 'Invalid original package snapshot' USING ERRCODE = '23514'; END IF;
      END IF;
    ELSE
      IF NEW."ordinal" > item."componentCountSnapshot" THEN RAISE EXCEPTION 'Invalid component order' USING ERRCODE = '23514'; END IF;
      IF NOT EXISTS (SELECT 1 FROM "ProfessionalService" ps JOIN "Service" s ON s."barbershopId" = ps."barbershopId" AND s."id" = ps."serviceId" WHERE ps."barbershopId" = NEW."barbershopId" AND ps."professionalId" = NEW."professionalId" AND ps."serviceId" = NEW."serviceId" AND s."status" = 'ACTIVE') THEN
        RAISE EXCEPTION 'Professional is not enabled for service' USING ERRCODE = '23514'; END IF;
      IF (item."kind" = 'SERVICE' AND NEW."serviceId" <> item."serviceId") OR (item."kind" = 'PACKAGE' AND NOT EXISTS (SELECT 1 FROM "ServicePackageItem" WHERE "barbershopId" = NEW."barbershopId" AND "packageId" = item."packageId" AND "serviceId" = NEW."serviceId")) THEN RAISE EXCEPTION 'Invalid package composition' USING ERRCODE = '23514'; END IF;
      SELECT * INTO catalog FROM "Service" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."serviceId";
      IF ROW(NEW."serviceNameSnapshot",NEW."priceCentsSnapshot",NEW."durationMinutesSnapshot") IS DISTINCT FROM ROW(catalog."name",catalog."priceCents",catalog."durationMinutes") THEN RAISE EXCEPTION 'Invalid original component snapshot' USING ERRCODE = '23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AppointmentItem_guard" BEFORE INSERT OR UPDATE ON "AppointmentItem" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_snapshot"();
CREATE TRIGGER "AppointmentComponent_guard" BEFORE INSERT ON "AppointmentServiceComponent" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_snapshot"();
CREATE TRIGGER "AppointmentComponent_immutable" BEFORE UPDATE ON "AppointmentServiceComponent" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();

CREATE FUNCTION "agenda_guard_entry"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor_id TEXT; role "TenantRole"; parent "Appointment"%ROWTYPE;
BEGIN
  actor_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."createdById" ELSE NEW."releasedById" END;
  PERFORM "agenda_actor_scope"(NEW."barbershopId",actor_id,NEW."professionalId");
  SELECT "roleSnapshot" INTO role FROM "CheckoutActor" WHERE "barbershopId" = NEW."barbershopId" AND "id" = actor_id;
  -- Future services pre-lock all affected professionals in sorted ID order.
  PERFORM 1 FROM "Professional" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."professionalId" FOR UPDATE;
  IF TG_OP = 'INSERT' THEN
    IF NEW."releasedAt" IS NOT NULL OR NEW."version" <> 0 OR NOT EXISTS (SELECT 1 FROM "Professional" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."professionalId" AND "status" = 'ACTIVE') THEN RAISE EXCEPTION 'Invalid initial occupation' USING ERRCODE = '23514'; END IF;
  ELSE
    IF OLD."releasedAt" IS NOT NULL OR NEW."releasedAt" IS NULL OR NEW."version" <> OLD."version" + 1 OR
       (to_jsonb(NEW) - ARRAY['releasedAt','releasedById','releaseReason','version']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['releasedAt','releasedById','releaseReason','version']) THEN RAISE EXCEPTION 'Occupations can only be released once' USING ERRCODE = '23514'; END IF;
  END IF;
  IF NEW."kind" = 'BLOCK' AND role = 'BARBER' AND NEW."startsAt" <= statement_timestamp() THEN RAISE EXCEPTION 'Barber blocks must be future' USING ERRCODE = '23514'; END IF;
  IF NEW."kind" = 'APPOINTMENT' THEN
    IF role = 'BARBER' THEN RAISE EXCEPTION 'Barber cannot reschedule occupations' USING ERRCODE = '23514'; END IF;
    SELECT * INTO parent FROM "Appointment" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."appointmentId" FOR UPDATE;
    IF NOT FOUND OR (TG_OP = 'INSERT' AND (parent."status" NOT IN ('SCHEDULED','CONFIRMED') OR NEW."professionalId" <> parent."professionalId")) OR
       (TG_OP = 'UPDATE' AND parent."status" NOT IN ('SCHEDULED','CONFIRMED','CANCELED','NO_SHOW')) THEN RAISE EXCEPTION 'Invalid appointment occupation' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ScheduleEntry_guard" BEFORE INSERT OR UPDATE ON "ScheduleEntry" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_entry"();

CREATE FUNCTION "agenda_guard_calendar"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE last_version INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM "agenda_actor_scope"(NEW."barbershopId",NEW."createdById",NEW."professionalId",true);
    IF NOT EXISTS (SELECT 1 FROM "Barbershop" WHERE "id" = NEW."barbershopId" AND "status" = 'ACTIVE' AND "timezone" = NEW."timezoneSnapshot") OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW."timezoneSnapshot") THEN RAISE EXCEPTION 'Invalid calendar timezone snapshot' USING ERRCODE = '23514'; END IF;
    IF NEW."publishedAt" IS NOT NULL OR NEW."effectiveUntil" IS NOT NULL THEN RAISE EXCEPTION 'Publish a complete calendar inside its creation transaction' USING ERRCODE = '23514'; END IF;
    -- Serialize configuration scopes without blocking actor FK key-share locks.
    PERFORM 1 FROM "Barbershop" WHERE "id" = NEW."barbershopId" FOR NO KEY UPDATE;
    SELECT max("version") INTO last_version FROM "ScheduleCalendar" WHERE "barbershopId" = NEW."barbershopId" AND "scope" = NEW."scope" AND "professionalId" IS NOT DISTINCT FROM NEW."professionalId";
    IF NEW."version" <> coalesce(last_version,0) + 1 THEN RAISE EXCEPTION 'Invalid calendar version' USING ERRCODE = '23514'; END IF;
  ELSE
    IF OLD."publishedAt" IS NULL THEN
      IF NEW."publishedAt" IS NULL OR (to_jsonb(NEW) - 'publishedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'publishedAt') THEN RAISE EXCEPTION 'Calendar draft can only be published' USING ERRCODE = '23514'; END IF;
      PERFORM "agenda_actor_scope"(NEW."barbershopId",NEW."createdById",NEW."professionalId",true);
    ELSE
      IF OLD."effectiveUntil" IS NOT NULL OR NEW."effectiveUntil" IS NULL OR
         (to_jsonb(NEW) - ARRAY['effectiveUntil','supersededById']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['effectiveUntil','supersededById']) THEN RAISE EXCEPTION 'Published calendar is immutable' USING ERRCODE = '23514'; END IF;
      PERFORM "agenda_actor_scope"(NEW."barbershopId",NEW."supersededById",NEW."professionalId",true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ScheduleCalendar_guard" BEFORE INSERT OR UPDATE ON "ScheduleCalendar" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_calendar"();

CREATE FUNCTION "agenda_guard_calendar_child"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE calendar_id TEXT; published TIMESTAMPTZ;
BEGIN
  IF TG_TABLE_NAME = 'ScheduleExceptionWindow' THEN
    SELECT "calendarId" INTO calendar_id FROM "ScheduleDateException" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."exceptionId";
  ELSE calendar_id := NEW."calendarId"; END IF;
  SELECT "publishedAt" INTO published FROM "ScheduleCalendar" WHERE "barbershopId" = NEW."barbershopId" AND "id" = calendar_id FOR UPDATE;
  IF NOT FOUND OR published IS NOT NULL THEN RAISE EXCEPTION 'Calendar snapshots are immutable after publication' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ScheduleWeeklyWindow_guard" BEFORE INSERT ON "ScheduleWeeklyWindow" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_calendar_child"();
CREATE TRIGGER "ScheduleDateException_guard" BEFORE INSERT ON "ScheduleDateException" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_calendar_child"();
CREATE TRIGGER "ScheduleExceptionWindow_guard" BEFORE INSERT ON "ScheduleExceptionWindow" FOR EACH ROW EXECUTE FUNCTION "agenda_guard_calendar_child"();
CREATE TRIGGER "ScheduleWeeklyWindow_immutable" BEFORE UPDATE ON "ScheduleWeeklyWindow" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();
CREATE TRIGGER "ScheduleDateException_immutable" BEFORE UPDATE ON "ScheduleDateException" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();
CREATE TRIGGER "ScheduleExceptionWindow_immutable" BEFORE UPDATE ON "ScheduleExceptionWindow" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();

-- Deferred invariants inspect the FINAL transaction state. Creating parent,
-- snapshots and occupation or retiring/replacing them must remain atomic.
CREATE FUNCTION "agenda_assert_appointment"(tenant TEXT, appointment_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE parent "Appointment"%ROWTYPE; entry "ScheduleEntry"%ROWTYPE; total BIGINT;
BEGIN
  SELECT * INTO parent FROM "Appointment" WHERE "barbershopId" = tenant AND "id" = appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing appointment' USING ERRCODE = '23514'; END IF;
  SELECT sum("quantity"::bigint * "durationMinutesSnapshot") INTO total FROM "AppointmentItem" WHERE "barbershopId" = tenant AND "appointmentId" = appointment_id AND "removedAt" IS NULL;
  IF total IS NULL OR total <> parent."plannedDurationMinutes" OR EXISTS (SELECT 1 FROM "AppointmentItem" WHERE "barbershopId" = tenant AND "appointmentId" = appointment_id AND "removedAt" IS NULL AND "professionalId" <> parent."professionalId") THEN
    RAISE EXCEPTION 'Invalid active appointment snapshots or duration' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM "AppointmentItem" i WHERE i."barbershopId" = tenant AND i."appointmentId" = appointment_id AND i."removedAt" IS NULL AND
    (SELECT count(*) FROM "AppointmentServiceComponent" c WHERE c."barbershopId" = tenant AND c."appointmentItemId" = i."id") <> i."componentCountSnapshot") THEN RAISE EXCEPTION 'Incomplete service composition' USING ERRCODE = '23514'; END IF;
  IF parent."status" IN ('CANCELED','NO_SHOW') THEN
    IF EXISTS (SELECT 1 FROM "ScheduleEntry" WHERE "barbershopId" = tenant AND "appointmentId" = appointment_id AND "releasedAt" IS NULL) THEN RAISE EXCEPTION 'Closed appointment must release occupation' USING ERRCODE = '23514'; END IF;
  ELSE
    SELECT * INTO entry FROM "ScheduleEntry" WHERE "barbershopId" = tenant AND "appointmentId" = appointment_id AND "releasedAt" IS NULL;
    IF NOT FOUND OR entry."professionalId" <> parent."professionalId" OR entry."endsAt" - entry."startsAt" <> make_interval(mins => coalesce(parent."adjustedDurationMinutes",parent."plannedDurationMinutes")) THEN RAISE EXCEPTION 'Appointment requires its exact active occupation' USING ERRCODE = '23514'; END IF;
  END IF;
  IF parent."status" = 'COMPLETED' THEN PERFORM "agenda_assert_completion"(tenant,appointment_id); END IF;
END;
$$;
-- Database-stamped top-level transaction identity, not a caller-supplied date.
-- Existing CheckoutAuditEvent guards prohibit UPDATE/DELETE of this evidence.
CREATE FUNCTION "agenda_stamp_audit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_typeof(NEW."metadata") IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid agenda audit metadata' USING ERRCODE = '23514'; END IF;
  NEW."metadata" := jsonb_set(NEW."metadata",'{_agendaTransactionId}',to_jsonb(pg_current_xact_id()::text));
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CheckoutAuditEvent_agenda_transaction" BEFORE INSERT ON "CheckoutAuditEvent" FOR EACH ROW WHEN (NEW."action" LIKE 'agenda.%') EXECUTE FUNCTION "agenda_stamp_audit"();

-- Typed round-trip accepts equivalent ISO timestamps while comparing real columns.
CREATE FUNCTION "agenda_audit_image"(entity_name TEXT, image JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  IF image = 'null'::jsonb THEN RETURN image; END IF;
  IF jsonb_typeof(image) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid agenda audit image' USING ERRCODE = '23514'; END IF;
  CASE entity_name
    WHEN 'Appointment' THEN RETURN to_jsonb(jsonb_populate_record(NULL::"Appointment",image));
    WHEN 'AppointmentItem' THEN RETURN to_jsonb(jsonb_populate_record(NULL::"AppointmentItem",image));
    WHEN 'AppointmentServiceComponent' THEN RETURN to_jsonb(jsonb_populate_record(NULL::"AppointmentServiceComponent",image));
    WHEN 'ScheduleEntry' THEN RETURN to_jsonb(jsonb_populate_record(NULL::"ScheduleEntry",image));
    WHEN 'ScheduleCalendar' THEN RETURN to_jsonb(jsonb_populate_record(NULL::"ScheduleCalendar",image));
    ELSE RAISE EXCEPTION 'Invalid agenda audit entity' USING ERRCODE = '23514';
  END CASE;
EXCEPTION WHEN data_exception THEN
  RAISE EXCEPTION 'Invalid agenda audit image' USING ERRCODE = '23514';
END;
$$;
CREATE FUNCTION "agenda_require_audit"(tenant TEXT, entity_name TEXT, entity_id TEXT, actor_id TEXT, revision INTEGER, expected_before JSONB, expected_after JSONB) RETURNS void LANGUAGE plpgsql AS $$
DECLARE evidence RECORD;
BEGIN
  FOR evidence IN SELECT "metadata" FROM "CheckoutAuditEvent" WHERE "barbershopId" = tenant AND "entity" = entity_name AND "entityId" = entity_id AND "actorId" = actor_id
    AND "action" LIKE 'agenda.%' AND "metadata"->>'_agendaTransactionId' = pg_current_xact_id()::text
    AND "metadata" ? 'before' AND "metadata" ? 'after' AND jsonb_typeof("metadata"->'reason') = 'string'
    AND length(btrim("metadata"->>'reason')) BETWEEN 1 AND 500
    AND coalesce("metadata"->>'version',"metadata"->'after'->>'version') = revision::text
  LOOP
    IF "agenda_audit_image"(entity_name,evidence."metadata"->'after') = expected_after AND
       (expected_before IS NULL OR "agenda_audit_image"(entity_name,evidence."metadata"->'before') = expected_before) THEN RETURN; END IF;
  END LOOP;
  RAISE EXCEPTION 'Agenda mutation requires its transactional audit' USING ERRCODE = '23514';
END;
$$;
CREATE FUNCTION "agenda_deferred_appointment"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id TEXT; parent "Appointment"%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME = 'Appointment' THEN parent_id := NEW."id";
  ELSIF TG_TABLE_NAME = 'AppointmentServiceComponent' THEN SELECT "appointmentId" INTO parent_id FROM "AppointmentItem" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."appointmentItemId";
  ELSE parent_id := NEW."appointmentId"; END IF;
  IF parent_id IS NOT NULL THEN
    PERFORM "agenda_assert_appointment"(NEW."barbershopId",parent_id);
    SELECT * INTO parent FROM "Appointment" WHERE "barbershopId" = NEW."barbershopId" AND "id" = parent_id;
    PERFORM "agenda_require_audit"(parent."barbershopId",'Appointment',parent."id",parent."updatedById",parent."version",NULL,to_jsonb(parent));
    IF TG_TABLE_NAME = 'Appointment' THEN
      PERFORM "agenda_require_audit"(NEW."barbershopId",'Appointment',NEW."id",NEW."updatedById",NEW."version",CASE WHEN TG_OP = 'INSERT' THEN 'null'::jsonb ELSE to_jsonb(OLD) END,to_jsonb(NEW));
    ELSIF TG_TABLE_NAME IN ('AppointmentItem','AppointmentServiceComponent') THEN
      PERFORM "agenda_require_audit"(NEW."barbershopId",TG_TABLE_NAME,NEW."id",parent."updatedById",parent."version",CASE WHEN TG_OP = 'INSERT' THEN 'null'::jsonb ELSE to_jsonb(OLD) END,to_jsonb(NEW));
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'ScheduleEntry' THEN
    PERFORM "agenda_require_audit"(NEW."barbershopId",'ScheduleEntry',NEW."id",coalesce(NEW."releasedById",NEW."createdById"),NEW."version",CASE WHEN TG_OP = 'INSERT' THEN 'null'::jsonb ELSE to_jsonb(OLD) END,to_jsonb(NEW));
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Appointment_consistency" AFTER INSERT OR UPDATE ON "Appointment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "agenda_deferred_appointment"();
CREATE CONSTRAINT TRIGGER "AppointmentItem_consistency" AFTER INSERT OR UPDATE ON "AppointmentItem" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "agenda_deferred_appointment"();
CREATE CONSTRAINT TRIGGER "AppointmentComponent_consistency" AFTER INSERT ON "AppointmentServiceComponent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "agenda_deferred_appointment"();
CREATE CONSTRAINT TRIGGER "ScheduleEntry_consistency" AFTER INSERT OR UPDATE ON "ScheduleEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "agenda_deferred_appointment"();

CREATE FUNCTION "agenda_deferred_calendar"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE calendar "ScheduleCalendar"%ROWTYPE;
BEGIN
  SELECT * INTO calendar FROM "ScheduleCalendar" WHERE "barbershopId" = NEW."barbershopId" AND "id" = NEW."id";
  IF calendar."publishedAt" IS NULL THEN RAISE EXCEPTION 'Calendar must be published before commit' USING ERRCODE = '23514'; END IF;
  -- The unpublished draft cannot survive commit. Creation/publication is one
  -- audited operation; subsequent closure compares the published before-image.
  PERFORM "agenda_require_audit"(calendar."barbershopId",'ScheduleCalendar',calendar."id",coalesce(calendar."supersededById",calendar."createdById"),calendar."version",CASE WHEN TG_OP = 'INSERT' OR OLD."publishedAt" IS NULL THEN 'null'::jsonb ELSE to_jsonb(OLD) END,to_jsonb(calendar));
  IF EXISTS (SELECT 1 FROM "ScheduleDateException" e WHERE e."barbershopId" = calendar."barbershopId" AND e."calendarId" = calendar."id" AND
    ((e."kind" = 'CLOSED' AND EXISTS (SELECT 1 FROM "ScheduleExceptionWindow" w WHERE w."barbershopId" = e."barbershopId" AND w."exceptionId" = e."id")) OR
     (e."kind" = 'REPLACE_WINDOWS' AND NOT EXISTS (SELECT 1 FROM "ScheduleExceptionWindow" w WHERE w."barbershopId" = e."barbershopId" AND w."exceptionId" = e."id")))) THEN
    RAISE EXCEPTION 'Invalid date exception windows' USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "ScheduleCalendar_consistency" AFTER INSERT OR UPDATE ON "ScheduleCalendar" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "agenda_deferred_calendar"();

CREATE TRIGGER "Appointment_no_delete" BEFORE DELETE ON "Appointment" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();
CREATE TRIGGER "AppointmentItem_no_delete" BEFORE DELETE ON "AppointmentItem" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();
CREATE TRIGGER "AppointmentComponent_no_delete" BEFORE DELETE ON "AppointmentServiceComponent" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();
CREATE TRIGGER "ScheduleEntry_no_delete" BEFORE DELETE ON "ScheduleEntry" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();
CREATE TRIGGER "ScheduleCalendar_no_delete" BEFORE DELETE ON "ScheduleCalendar" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();
CREATE TRIGGER "ScheduleWeeklyWindow_no_delete" BEFORE DELETE ON "ScheduleWeeklyWindow" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();
CREATE TRIGGER "ScheduleDateException_no_delete" BEFORE DELETE ON "ScheduleDateException" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();
CREATE TRIGGER "ScheduleExceptionWindow_no_delete" BEFORE DELETE ON "ScheduleExceptionWindow" FOR EACH ROW EXECUTE FUNCTION "agenda_reject_mutation"();

COMMIT;

