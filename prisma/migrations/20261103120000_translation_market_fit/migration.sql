-- Smart selection holds back translations that do not suit the target market.
ALTER TYPE "TranslationStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

CREATE TYPE "TranslationSelection" AS ENUM ('SMART', 'ALL');
ALTER TABLE "ClientSite" ADD COLUMN "translationSelection" "TranslationSelection" NOT NULL DEFAULT 'SMART';

ALTER TABLE "ArticleTranslation" ADD COLUMN "marketFit" JSONB;
