CREATE TYPE "AiCrawlerKind" AS ENUM ('ANSWER_ENGINE', 'TRAINING', 'SEARCH');
CREATE TYPE "AiCrawlerSurface" AS ENUM ('ARTICLE', 'MARKDOWN', 'LLMS', 'RSS', 'HOMEPAGE', 'OTHER');
CREATE TYPE "AiReferralChannel" AS ENUM ('CHATGPT', 'PERPLEXITY', 'GEMINI', 'COPILOT', 'CLAUDE', 'OTHER_AI');
CREATE TYPE "AiPromptIntent" AS ENUM ('DISCOVERY', 'COMPARISON', 'PROBLEM', 'HOW_TO', 'OTHER');
CREATE TYPE "AiPromptSource" AS ENUM ('MANUAL', 'GENERATED', 'SEARCH_CONSOLE');
CREATE TYPE "AiVisibilityProvider" AS ENUM ('OPENAI');
CREATE TYPE "AiVisibilityRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "AiOpportunityKind" AS ENUM ('UPDATE_ARTICLE', 'CREATE_ARTICLE');
CREATE TYPE "AiOpportunityStatus" AS ENUM ('OPEN', 'DISMISSED', 'RESOLVED');

CREATE TABLE "AiCrawlerDaily" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "bot" TEXT NOT NULL,
    "kind" "AiCrawlerKind" NOT NULL,
    "surface" "AiCrawlerSurface" NOT NULL,
    "path" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "rateLimitedCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiCrawlerDaily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiReferralVisit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "channel" "AiReferralChannel" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "referrerHost" TEXT NOT NULL,
    "visitedOn" DATE NOT NULL,
    CONSTRAINT "AiReferralVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiVisibilityPrompt" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "intent" "AiPromptIntent" NOT NULL DEFAULT 'OTHER',
    "source" "AiPromptSource" NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    CONSTRAINT "AiVisibilityPrompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiVisibilityRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "provider" "AiVisibilityProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AiVisibilityRunStatus" NOT NULL DEFAULT 'RUNNING',
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchedWeb" BOOLEAN NOT NULL DEFAULT false,
    "brandMentioned" BOOLEAN NOT NULL DEFAULT false,
    "responseText" TEXT,
    "error" TEXT,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "usage" JSONB,
    CONSTRAINT "AiVisibilityRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCitation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "articleId" TEXT,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "owned" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    CONSTRAINT "AiCitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiVisibilityOpportunity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "articleId" TEXT,
    "kind" "AiOpportunityKind" NOT NULL,
    "status" "AiOpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "citedDomains" TEXT[] NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "ownedHits" INTEGER NOT NULL,
    "externalHits" INTEGER NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiVisibilityOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiCrawlerDaily_clientSiteId_date_bot_path_key" ON "AiCrawlerDaily"("clientSiteId", "date", "bot", "path");
CREATE INDEX "AiCrawlerDaily_clientSiteId_date_idx" ON "AiCrawlerDaily"("clientSiteId", "date");
CREATE INDEX "AiCrawlerDaily_clientSiteId_kind_date_idx" ON "AiCrawlerDaily"("clientSiteId", "kind", "date");
CREATE UNIQUE INDEX "AiReferralVisit_articleId_sessionId_visitedOn_channel_key" ON "AiReferralVisit"("articleId", "sessionId", "visitedOn", "channel");
CREATE INDEX "AiReferralVisit_clientSiteId_visitedOn_idx" ON "AiReferralVisit"("clientSiteId", "visitedOn");
CREATE INDEX "AiReferralVisit_clientSiteId_channel_visitedOn_idx" ON "AiReferralVisit"("clientSiteId", "channel", "visitedOn");
CREATE UNIQUE INDEX "AiVisibilityPrompt_clientSiteId_text_language_country_key" ON "AiVisibilityPrompt"("clientSiteId", "text", "language", "country");
CREATE INDEX "AiVisibilityPrompt_clientSiteId_active_lastRunAt_idx" ON "AiVisibilityPrompt"("clientSiteId", "active", "lastRunAt");
CREATE INDEX "AiVisibilityRun_clientSiteId_executedAt_idx" ON "AiVisibilityRun"("clientSiteId", "executedAt");
CREATE INDEX "AiVisibilityRun_promptId_executedAt_idx" ON "AiVisibilityRun"("promptId", "executedAt");
CREATE UNIQUE INDEX "AiCitation_runId_normalizedUrl_key" ON "AiCitation"("runId", "normalizedUrl");
CREATE INDEX "AiCitation_clientSiteId_owned_createdAt_idx" ON "AiCitation"("clientSiteId", "owned", "createdAt");
CREATE INDEX "AiCitation_articleId_createdAt_idx" ON "AiCitation"("articleId", "createdAt");
CREATE UNIQUE INDEX "AiVisibilityOpportunity_clientSiteId_promptId_key" ON "AiVisibilityOpportunity"("clientSiteId", "promptId");
CREATE INDEX "AiVisibilityOpportunity_clientSiteId_status_lastSeenAt_idx" ON "AiVisibilityOpportunity"("clientSiteId", "status", "lastSeenAt");

ALTER TABLE "AiCrawlerDaily" ADD CONSTRAINT "AiCrawlerDaily_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiReferralVisit" ADD CONSTRAINT "AiReferralVisit_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiReferralVisit" ADD CONSTRAINT "AiReferralVisit_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiVisibilityPrompt" ADD CONSTRAINT "AiVisibilityPrompt_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiVisibilityRun" ADD CONSTRAINT "AiVisibilityRun_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiVisibilityRun" ADD CONSTRAINT "AiVisibilityRun_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiVisibilityPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCitation" ADD CONSTRAINT "AiCitation_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCitation" ADD CONSTRAINT "AiCitation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiVisibilityRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCitation" ADD CONSTRAINT "AiCitation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiVisibilityOpportunity" ADD CONSTRAINT "AiVisibilityOpportunity_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiVisibilityOpportunity" ADD CONSTRAINT "AiVisibilityOpportunity_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiVisibilityPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiVisibilityOpportunity" ADD CONSTRAINT "AiVisibilityOpportunity_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
