-- An active ARTICLE_CRONS feature with NONE could never run, and client settings had no frequency
-- control with which to repair it. Match the feature toggle's new DAILY default for existing sites.
UPDATE "ClientSite" AS cs
SET "generationFrequency" = 'DAILY'::"GenerationFrequency",
    "updatedAt" = NOW()
WHERE cs."generationFrequency" = 'NONE'::"GenerationFrequency"
  AND EXISTS (
    SELECT 1
    FROM "ClientFeature" AS cf
    INNER JOIN "Feature" AS f ON f."id" = cf."featureId"
    WHERE cf."clientSiteId" = cs."id"
      AND cf."isActive" = true
      AND f."code" = 'ARTICLE_CRONS'::"FeatureCodes"
  );
