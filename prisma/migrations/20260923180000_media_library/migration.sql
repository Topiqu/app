CREATE TYPE "public"."MediaUsagePlacement" AS ENUM ('COVER', 'BODY');

ALTER TABLE "public"."MediaAsset"
    ADD COLUMN "deliveryUrl" TEXT,
    ADD COLUMN "name" TEXT,
    ADD COLUMN "defaultAltText" TEXT,
    ADD COLUMN "sizeBytes" INTEGER,
    ADD COLUMN "machineTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "archivedAt" TIMESTAMP(3),
    ADD COLUMN "purgeAfter" TIMESTAMP(3),
    ADD COLUMN "purgedAt" TIMESTAMP(3);

CREATE TABLE "public"."ArticleMediaUsage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "articleTranslationId" TEXT,
    "language" "public"."Language" NOT NULL,
    "placement" "public"."MediaUsagePlacement" NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ArticleMediaUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MediaAsset_clientSiteId_archivedAt_createdAt_idx"
    ON "public"."MediaAsset"("clientSiteId", "archivedAt", "createdAt");
CREATE INDEX "MediaAsset_clientSiteId_origin_createdAt_idx"
    ON "public"."MediaAsset"("clientSiteId", "origin", "createdAt");
CREATE UNIQUE INDEX "ArticleMediaUsage_mediaAssetId_articleId_language_placement_key"
    ON "public"."ArticleMediaUsage"("mediaAssetId", "articleId", "language", "placement");
CREATE INDEX "ArticleMediaUsage_clientSiteId_articleId_idx"
    ON "public"."ArticleMediaUsage"("clientSiteId", "articleId");
CREATE INDEX "ArticleMediaUsage_mediaAssetId_articleId_idx"
    ON "public"."ArticleMediaUsage"("mediaAssetId", "articleId");

ALTER TABLE "public"."ArticleMediaUsage"
    ADD CONSTRAINT "ArticleMediaUsage_clientSiteId_fkey" FOREIGN KEY ("clientSiteId")
    REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ArticleMediaUsage"
    ADD CONSTRAINT "ArticleMediaUsage_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId")
    REFERENCES "public"."MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ArticleMediaUsage"
    ADD CONSTRAINT "ArticleMediaUsage_articleId_fkey" FOREIGN KEY ("articleId")
    REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ArticleMediaUsage"
    ADD CONSTRAINT "ArticleMediaUsage_articleTranslationId_fkey" FOREIGN KEY ("articleTranslationId")
    REFERENCES "public"."ArticleTranslation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
