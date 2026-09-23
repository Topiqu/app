CREATE TYPE "public"."MediaOrigin" AS ENUM ('UNKNOWN', 'OWN', 'TOPIQU_AI', 'EXTERNAL_AI', 'LICENSED_STOCK', 'CREATIVE_COMMONS', 'PUBLIC_DOMAIN', 'EXTERNAL', 'OTHER');

CREATE TABLE "public"."MediaAsset" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "createdById" TEXT,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "contentHash" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "origin" "public"."MediaOrigin" NOT NULL DEFAULT 'UNKNOWN',
    "sourceUrl" TEXT,
    "author" TEXT,
    "license" TEXT,
    "licenseUrl" TEXT,
    "attribution" TEXT,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT false,
    "rightsConfirmedAt" TIMESTAMP(3),
    "rightsConfirmedById" TEXT,
    "metadataSignals" JSONB,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."MediaRightsPublicationSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "articleId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "language" "public"."Language" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "issueCount" INTEGER NOT NULL,
    "overrideConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "legacySchedule" BOOLEAN NOT NULL DEFAULT false,
    "confirmedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaRightsPublicationSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."Article" ADD COLUMN "coverMediaId" TEXT;
ALTER TABLE "public"."ArticleDraft" ADD COLUMN "coverMediaId" TEXT;

CREATE INDEX "MediaAsset_clientSiteId_contentHash_idx" ON "public"."MediaAsset"("clientSiteId", "contentHash");
CREATE INDEX "MediaAsset_clientSiteId_url_idx" ON "public"."MediaAsset"("clientSiteId", "url");
CREATE INDEX "MediaRightsPublicationSnapshot_articleId_publishedAt_idx" ON "public"."MediaRightsPublicationSnapshot"("articleId", "publishedAt");

ALTER TABLE "public"."MediaAsset" ADD CONSTRAINT "MediaAsset_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."MediaAsset" ADD CONSTRAINT "MediaAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."MediaAsset" ADD CONSTRAINT "MediaAsset_rightsConfirmedById_fkey" FOREIGN KEY ("rightsConfirmedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."MediaRightsPublicationSnapshot" ADD CONSTRAINT "MediaRightsPublicationSnapshot_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."MediaRightsPublicationSnapshot" ADD CONSTRAINT "MediaRightsPublicationSnapshot_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."MediaRightsPublicationSnapshot" ADD CONSTRAINT "MediaRightsPublicationSnapshot_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "public"."MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ArticleDraft" ADD CONSTRAINT "ArticleDraft_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "public"."MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
