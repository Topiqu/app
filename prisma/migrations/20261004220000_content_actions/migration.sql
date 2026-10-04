CREATE TYPE "public"."ContentActionType" AS ENUM ('REFRESH', 'EXPAND');

CREATE TYPE "public"."ContentActionStatus" AS ENUM ('SUGGESTED', 'QUEUED', 'READY', 'APPLIED', 'DISMISSED', 'FAILED', 'ROLLED_BACK');

CREATE TABLE "public"."ContentAction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "keywordClusterId" TEXT,
    "type" "public"."ContentActionType" NOT NULL,
    "status" "public"."ContentActionStatus" NOT NULL DEFAULT 'SUGGESTED',
    "keyword" TEXT NOT NULL,
    "reason" TEXT,
    "angle" TEXT,
    "positionBefore" INTEGER,
    "positionAfter" INTEGER,
    "measuredAt" TIMESTAMP(3),
    "proposal" JSONB,
    "snapshot" JSONB,
    "creditOperationId" TEXT,
    "error" TEXT,
    "queuedAt" TIMESTAMP(3),
    "processingUntil" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "ContentAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentAction_clientSiteId_status_idx" ON "public"."ContentAction"("clientSiteId", "status");
CREATE INDEX "ContentAction_status_queuedAt_idx" ON "public"."ContentAction"("status", "queuedAt");
CREATE INDEX "ContentAction_articleId_createdAt_idx" ON "public"."ContentAction"("articleId", "createdAt");

ALTER TABLE "public"."ContentAction"
    ADD CONSTRAINT "ContentAction_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ContentAction_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ContentAction_keywordClusterId_fkey" FOREIGN KEY ("keywordClusterId") REFERENCES "public"."KeywordCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
