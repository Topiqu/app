-- CreateEnum
CREATE TYPE "FeatureCodes" AS ENUM ('AI', 'CRONS', 'SENTIMENT', 'ARTICLE_CRONS');

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "code" "FeatureCodes" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "priceAnnual" INTEGER,
    "tier" TEXT,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFeature" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "billingLockedUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClientFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feature_code_key" ON "Feature"("code");

-- CreateIndex
CREATE INDEX "ClientFeature_clientSiteId_idx" ON "ClientFeature"("clientSiteId");

-- CreateIndex
CREATE INDEX "ClientFeature_billingLockedUntil_idx" ON "ClientFeature"("billingLockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ClientFeature_clientSiteId_featureId_key" ON "ClientFeature"("clientSiteId", "featureId");

-- AddForeignKey
ALTER TABLE "ClientFeature" ADD CONSTRAINT "ClientFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFeature" ADD CONSTRAINT "ClientFeature_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
