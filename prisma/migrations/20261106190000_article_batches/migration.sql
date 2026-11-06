-- Reserved topics stay out of the autopilot picker and survive plan rebuilds until their article is written.
ALTER TYPE "public"."KeywordClusterStatus" ADD VALUE 'RESERVED';

CREATE TYPE "public"."ArticleBatchStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'FINISHED', 'CANCELLED');
CREATE TYPE "public"."ArticleBatchMode" AS ENUM ('SPREAD', 'DRAFTS');
CREATE TYPE "public"."ArticleBatchItemStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE "public"."ArticleBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" "public"."ArticleBatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "mode" "public"."ArticleBatchMode",
    "paceHours" INTEGER,
    "proposal" JSONB NOT NULL,
    "proposingUntil" TIMESTAMP(3),
    "pausedUntil" TIMESTAMP(3),
    "pauseReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "ArticleBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ArticleBatchItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "batchId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "instructions" TEXT,
    "keywordClusterId" TEXT,
    "clusterPinned" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "public"."ArticleBatchItemStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "articleId" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    CONSTRAINT "ArticleBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArticleBatch_clientSiteId_createdAt_idx" ON "public"."ArticleBatch"("clientSiteId", "createdAt");
CREATE INDEX "ArticleBatch_status_idx" ON "public"."ArticleBatch"("status");
CREATE INDEX "ArticleBatchItem_status_scheduledFor_idx" ON "public"."ArticleBatchItem"("status", "scheduledFor");
CREATE INDEX "ArticleBatchItem_batchId_scheduledFor_idx" ON "public"."ArticleBatchItem"("batchId", "scheduledFor");
-- Race backstop for the one-live-batch rule the routes check under the site lock.
CREATE UNIQUE INDEX "ArticleBatch_live_tenant_key" ON "public"."ArticleBatch"("clientSiteId")
    WHERE "status" IN ('PROPOSED', 'ACTIVE') AND "deletedAt" IS NULL;

ALTER TABLE "public"."ArticleBatch"
    ADD CONSTRAINT "ArticleBatch_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ArticleBatch_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ArticleBatchItem"
    ADD CONSTRAINT "ArticleBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."ArticleBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ArticleBatchItem_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ArticleBatchItem_keywordClusterId_fkey" FOREIGN KEY ("keywordClusterId") REFERENCES "public"."KeywordCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ArticleBatchItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
