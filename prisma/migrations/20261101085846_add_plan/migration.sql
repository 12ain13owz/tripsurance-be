-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('SINGLE_TRIP');

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PlanType" NOT NULL DEFAULT 'SINGLE_TRIP',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPriceTier" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "minDays" INTEGER NOT NULL,
    "maxDays" INTEGER NOT NULL,
    "pricePerTraveller" INTEGER NOT NULL,

    CONSTRAINT "PlanPriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCoverage" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "PlanCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCountry" (
    "planId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "PlanCountry_pkey" PRIMARY KEY ("planId","countryId")
);

-- CreateTable
CREATE TABLE "PlanAddon" (
    "planId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,

    CONSTRAINT "PlanAddon_pkey" PRIMARY KEY ("planId","addonId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPriceTier_planId_minDays_key" ON "PlanPriceTier"("planId", "minDays");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCoverage_planId_categoryKey_key" ON "PlanCoverage"("planId", "categoryKey");

-- CreateIndex
CREATE INDEX "PlanCountry_countryId_idx" ON "PlanCountry"("countryId");

-- AddForeignKey
ALTER TABLE "PlanPriceTier" ADD CONSTRAINT "PlanPriceTier_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCoverage" ADD CONSTRAINT "PlanCoverage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCountry" ADD CONSTRAINT "PlanCountry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCountry" ADD CONSTRAINT "PlanCountry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAddon" ADD CONSTRAINT "PlanAddon_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAddon" ADD CONSTRAINT "PlanAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
