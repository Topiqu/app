ALTER TYPE "AiPromptSource" ADD VALUE IF NOT EXISTS 'ARTICLE';
ALTER TYPE "AiPromptSource" ADD VALUE IF NOT EXISTS 'COMMENT';
CREATE TYPE "AiDomainMark" AS ENUM ('COMPETITOR', 'HIDDEN');

ALTER TABLE "ClientSite" ADD COLUMN "aiPromptsSeededAt" TIMESTAMP(3);

ALTER TABLE "AiVisibilityPrompt" ADD COLUMN "articleId" TEXT;
CREATE INDEX "AiVisibilityPrompt_articleId_idx" ON "AiVisibilityPrompt"("articleId");
ALTER TABLE "AiVisibilityPrompt" ADD CONSTRAINT "AiVisibilityPrompt_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AiVisibilityDomain" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "mark" "AiDomainMark" NOT NULL,
    CONSTRAINT "AiVisibilityDomain_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiVisibilityDomain_clientSiteId_domain_key" ON "AiVisibilityDomain"("clientSiteId", "domain");
ALTER TABLE "AiVisibilityDomain" ADD CONSTRAINT "AiVisibilityDomain_clientSiteId_fkey"
    FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
