-- Add publication and account locales. Preserve the old implicit cs/en translation targets
-- for existing tenants before an empty list starts including de/fr as well.
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'de';
ALTER TYPE "Language" ADD VALUE IF NOT EXISTS 'fr';

UPDATE "ClientSite"
SET "translationLanguages" = CASE
  WHEN "language" = 'cs' THEN ARRAY['en'::"Language"]
  ELSE ARRAY['cs'::"Language"]
END
WHERE "translationLanguages" IS NULL OR cardinality("translationLanguages") = 0;
