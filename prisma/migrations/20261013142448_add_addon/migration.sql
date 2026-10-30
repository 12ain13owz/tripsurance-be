-- CreateEnum
CREATE TYPE "AddonPricingType" AS ENUM ('PER_ORDER', 'PER_TRAVELLER', 'PER_TRAVELLER_PER_DAY');

-- CreateTable
CREATE TABLE "Addon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pricingType" "AddonPricingType" NOT NULL,
    "price" INTEGER NOT NULL,
    "coverageAmount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Addon_code_key" ON "Addon"("code");
