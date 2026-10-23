BEGIN;

CREATE TYPE "WebsiteImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'REVIEWED', 'FAILED');

CREATE TABLE "WebsiteImport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "createdById" TEXT,
    "consentVersion" INTEGER NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "WebsiteImportStatus" NOT NULL DEFAULT 'PENDING',
    "baseline" JSONB NOT NULL,
    "result" JSONB,
    "acceptedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "searchStartedAt" TIMESTAMP(3),
    "searchCompletedAt" TIMESTAMP(3),
    "searchText" TEXT,
    "searchSources" JSONB,
    "extractionStartedAt" TIMESTAMP(3),
    "extractionCompletedAt" TIMESTAMP(3),
    "budgetDay" TIMESTAMP(3),
    "reservedCostMicros" INTEGER NOT NULL DEFAULT 0,
    "budgetCostMicros" INTEGER NOT NULL DEFAULT 0,
    "usage" JSONB,
    "errorCode" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    CONSTRAINT "WebsiteImport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WebsiteImport_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebsiteImport_budget_nonnegative" CHECK ("reservedCostMicros" >= 0 AND "budgetCostMicros" >= 0)
);

CREATE INDEX "WebsiteImport_clientSiteId_createdAt_idx" ON "WebsiteImport"("clientSiteId", "createdAt");
CREATE INDEX "WebsiteImport_status_leaseUntil_idx" ON "WebsiteImport"("status", "leaseUntil");
CREATE INDEX "WebsiteImport_budgetDay_idx" ON "WebsiteImport"("budgetDay");
CREATE UNIQUE INDEX "WebsiteImport_active_tenant_key" ON "WebsiteImport"("clientSiteId")
    WHERE "deletedAt" IS NULL AND "status" IN ('PENDING', 'PROCESSING', 'READY');

ALTER TABLE "KnowledgeSource" ADD COLUMN "websiteImportId" TEXT;
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_websiteImportId_fkey"
    FOREIGN KEY ("websiteImportId") REFERENCES "WebsiteImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "KnowledgeSource_websiteImportId_idx" ON "KnowledgeSource"("websiteImportId");

COMMIT;
