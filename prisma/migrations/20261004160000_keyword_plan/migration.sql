CREATE TYPE "public"."KeywordClusterStatus" AS ENUM ('OPEN', 'PINNED', 'USED', 'SKIPPED');

ALTER TABLE "public"."ClientSite" ADD COLUMN "keywordPlanRefreshedAt" TIMESTAMP(3);

CREATE TABLE "public"."KeywordCluster" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "difficulty" INTEGER,
    "intent" TEXT NOT NULL,
    "questions" TEXT[],
    "aiOverview" BOOLEAN NOT NULL DEFAULT false,
    "domains" TEXT[],
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "public"."KeywordClusterStatus" NOT NULL DEFAULT 'OPEN',
    "articleId" TEXT,
    "usedAt" TIMESTAMP(3),
    CONSTRAINT "KeywordCluster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KeywordCluster_clientSiteId_keyword_key" ON "public"."KeywordCluster"("clientSiteId", "keyword");
CREATE INDEX "KeywordCluster_clientSiteId_status_score_idx" ON "public"."KeywordCluster"("clientSiteId", "status", "score");

ALTER TABLE "public"."KeywordCluster"
    ADD CONSTRAINT "KeywordCluster_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "KeywordCluster_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."ClientSite" ADD COLUMN "keywordPlanProfile" TEXT;

ALTER TABLE "public"."Article" ADD COLUMN "newsUrl" TEXT;

ALTER TABLE "public"."ClientSite" ADD COLUMN "keywordMarket" TEXT;

ALTER TABLE "public"."KeywordCluster"
    ADD COLUMN "pillar" TEXT,
    ADD COLUMN "position" INTEGER,
    ADD COLUMN "rankHistory" JSONB,
    ADD COLUMN "nextRankCheckAt" TIMESTAMP(3);

CREATE INDEX "KeywordCluster_status_nextRankCheckAt_idx" ON "public"."KeywordCluster"("status", "nextRankCheckAt");
