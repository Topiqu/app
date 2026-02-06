/*
  Warnings:

  - A unique constraint covering the columns `[slug,clientSiteId]` on the table `Article` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shortcode,clientSiteId]` on the table `Emoji` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Article_slug_key";

-- DropIndex
DROP INDEX "public"."Article_title_excerpt_clientSiteId_idx";

-- DropIndex
DROP INDEX "public"."Emoji_shortcode_key";

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "articleSeriesId" TEXT,
ADD COLUMN     "savedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "savedTimeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seriesOrder" INTEGER DEFAULT 0,
ADD COLUMN     "totalWords" INTEGER;

-- AlterTable
ALTER TABLE "ClientSite" ADD COLUMN     "apiKey" TEXT,
ADD COLUMN     "humanHourlyRate" INTEGER NOT NULL DEFAULT 1400,
ADD COLUMN     "humanWordsPerHour" INTEGER NOT NULL DEFAULT 400;

-- CreateTable
CREATE TABLE "ArticleSeries" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "clientSiteId" TEXT NOT NULL,

    CONSTRAINT "ArticleSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleFeedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "articleId" TEXT NOT NULL,
    "isHelpful" BOOLEAN NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "ArticleFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleSeries_slug_clientSiteId_key" ON "ArticleSeries"("slug", "clientSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleFeedback_articleId_userId_sessionId_key" ON "ArticleFeedback"("articleId", "userId", "sessionId");

-- CreateIndex
CREATE INDEX "Article_title_excerpt_clientSiteId_articleSeriesId_seriesOr_idx" ON "Article"("title", "excerpt", "clientSiteId", "articleSeriesId", "seriesOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_clientSiteId_key" ON "Article"("slug", "clientSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Emoji_shortcode_clientSiteId_key" ON "Emoji"("shortcode", "clientSiteId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_articleSeriesId_fkey" FOREIGN KEY ("articleSeriesId") REFERENCES "ArticleSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSeries" ADD CONSTRAINT "ArticleSeries_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleFeedback" ADD CONSTRAINT "ArticleFeedback_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleFeedback" ADD CONSTRAINT "ArticleFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
