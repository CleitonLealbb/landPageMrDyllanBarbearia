CREATE TABLE "TvMedia" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'VIDEO',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TvMedia_barbershopId_idx"
ON "TvMedia"("barbershopId");

ALTER TABLE "TvMedia"
ADD CONSTRAINT "TvMedia_barbershopId_fkey"
FOREIGN KEY ("barbershopId")
REFERENCES "Barbershop"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;