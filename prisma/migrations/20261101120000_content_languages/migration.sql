-- Content languages grow independently of the interface languages.
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'es';
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'it';
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'pl';
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'sk';
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'nl';
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'pt';

CREATE TYPE "UiLanguage" AS ENUM ('cs', 'en', 'de', 'fr');

ALTER TABLE "User" ALTER COLUMN "language" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "language" TYPE "UiLanguage" USING ("language"::text::"UiLanguage");
ALTER TABLE "User" ALTER COLUMN "language" SET DEFAULT 'en';

-- Translation languages bought beyond the plan allowance.
ALTER TABLE "ClientSite" ADD COLUMN "extraTranslationLanguages" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClientSite" ADD COLUMN "languageSubscriptionId" TEXT;

-- An empty selection used to mean "every other language" and now means "none". Write the old meaning out
-- for sites that translate, so nothing stops silently; the plan allowance then pauses what it does not cover.
UPDATE "ClientSite"
SET "translationLanguages" = ARRAY(
  SELECT candidate
  FROM unnest(ARRAY['en', 'cs', 'de', 'fr']::"Language"[]) AS candidate
  WHERE candidate <> "ClientSite"."language"
)
WHERE "translationMode" <> 'OFF' AND cardinality("translationLanguages") = 0;
