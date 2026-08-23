CREATE TYPE "PublicationTypography" AS ENUM ('MODERN', 'EDITORIAL', 'SYSTEM');

ALTER TABLE "ClientSite"
ADD COLUMN "tagline" TEXT,
ADD COLUMN "faviconUrl" TEXT,
ADD COLUMN "typographyPreset" "PublicationTypography" NOT NULL DEFAULT 'MODERN';
