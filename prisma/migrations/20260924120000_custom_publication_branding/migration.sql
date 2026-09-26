ALTER TYPE "PublicationTypography" ADD VALUE 'CUSTOM';
ALTER TYPE "PublicationTypography" ADD VALUE 'MAGAZINE';

ALTER TABLE "ClientSite"
ADD COLUMN "accentColor" TEXT,
ADD COLUMN "brandGradient" JSONB,
ADD COLUMN "headingFontUrl" TEXT,
ADD COLUMN "bodyFontUrl" TEXT;
