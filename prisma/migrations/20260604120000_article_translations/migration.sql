-- Automated AI article translations: ArticleTranslation sidecar + per-tenant config.
-- Translations are a 1:N branch off Article (cascade), with denormalized clientSiteId
-- for tenant-scoped slug uniqueness and indexing. Public reads are gated to PUBLISHED
-- via ZenStack policy; status drives the SEO indexing/hreflang lifecycle.

-- CreateEnum
CREATE TYPE "TranslationMode" AS ENUM ('OFF', 'MANUAL', 'AUTO', 'HYBRID');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('PENDING', 'TRANSLATING', 'READY', 'PUBLISHED', 'FAILED', 'STALE');

-- CreateEnum
CREATE TYPE "TranslationSource" AS ENUM ('AI', 'HUMAN');

-- AlterTable
ALTER TABLE "ClientSite" ADD COLUMN     "translationLanguages" "Language"[],
ADD COLUMN     "translationMode" "TranslationMode" NOT NULL DEFAULT 'OFF';

-- CreateTable
CREATE TABLE "ArticleTranslation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "articleId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "status" "TranslationStatus" NOT NULL DEFAULT 'PENDING',
    "source" "TranslationSource" NOT NULL DEFAULT 'AI',
    "model" TEXT,
    "usage" JSONB,
    "error" TEXT,
    "translatedAt" TIMESTAMP(3),

    CONSTRAINT "ArticleTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleTranslation_clientSiteId_status_language_idx" ON "ArticleTranslation"("clientSiteId", "status", "language");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTranslation_articleId_language_key" ON "ArticleTranslation"("articleId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTranslation_slug_clientSiteId_language_key" ON "ArticleTranslation"("slug", "clientSiteId", "language");

-- AddForeignKey
ALTER TABLE "ArticleTranslation" ADD CONSTRAINT "ArticleTranslation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTranslation" ADD CONSTRAINT "ArticleTranslation_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
