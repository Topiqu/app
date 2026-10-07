CREATE TYPE "public"."BacklinkOpportunityKind" AS ENUM ('UNLINKED_MENTION', 'SUPPLIER');

CREATE TYPE "public"."BacklinkOpportunityStatus" AS ENUM ('OPEN', 'SENT', 'WON', 'DISMISSED', 'EXPIRED');

CREATE TABLE "public"."BacklinkOpportunity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "kind" "public"."BacklinkOpportunityKind" NOT NULL,
    "status" "public"."BacklinkOpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "sourceUrl" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "title" TEXT,
    "evidence" JSONB NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "contactUrl" TEXT,
    "draft" JSONB,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    CONSTRAINT "BacklinkOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BacklinkOpportunity_clientSiteId_kind_sourceUrl_key" ON "public"."BacklinkOpportunity"("clientSiteId", "kind", "sourceUrl");
CREATE INDEX "BacklinkOpportunity_clientSiteId_status_idx" ON "public"."BacklinkOpportunity"("clientSiteId", "status");
CREATE INDEX "BacklinkOpportunity_status_nextCheckAt_idx" ON "public"."BacklinkOpportunity"("status", "nextCheckAt");

ALTER TABLE "public"."BacklinkOpportunity"
    ADD CONSTRAINT "BacklinkOpportunity_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."Backlink" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "rel" TEXT[],
    "anchor" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lostAt" TIMESTAMP(3),
    "missedChecks" INTEGER NOT NULL DEFAULT 0,
    "nextCheckAt" TIMESTAMP(3),
    CONSTRAINT "Backlink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Backlink_clientSiteId_sourceUrl_key" ON "public"."Backlink"("clientSiteId", "sourceUrl");
CREATE INDEX "Backlink_nextCheckAt_idx" ON "public"."Backlink"("nextCheckAt");

ALTER TABLE "public"."Backlink"
    ADD CONSTRAINT "Backlink_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Backlink_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."BacklinkOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."ClientSite"
    ADD COLUMN "backlinksRefreshedAt" TIMESTAMP(3),
    ADD COLUMN "backlinksAttemptedAt" TIMESTAMP(3);

-- Filled by the next feed sync: `brand` joins the hashed product facts, so every feed counts as changed once,
-- while the embedded product text already carried the brand and is not re-embedded.
ALTER TABLE "public"."KnowledgeProduct" ADD COLUMN "brand" TEXT;
