-- Feature rows are runtime configuration, not development fixtures. Production never runs
-- prisma/seed.ts, so ensure the catalog exists before repairing plan-granted ClientFeature rows.
INSERT INTO "Feature" ("id", "createdAt", "updatedAt", "code", "name", "priceMonthly")
VALUES
  (gen_random_uuid()::text, now(), now(), 'AI', 'AI Generation', 29),
  (gen_random_uuid()::text, now(), now(), 'SENTIMENT', 'Sentiment Analysis', 19),
  (gen_random_uuid()::text, now(), now(), 'ARTICLE_CRONS', 'Scheduled Article Generation', 19)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "ClientFeature" (
  "id", "createdAt", "updatedAt", "clientSiteId", "featureId",
  "activatedAt", "billingLockedUntil", "isActive"
)
SELECT gen_random_uuid()::text, now(), now(), cs."id", f."id", now(), now(), true
FROM "ClientSite" cs
JOIN "Feature" f
  ON (f."code" = 'AI' AND cs."plan" IN ('PRO', 'PREMIUM'))
  OR (f."code" = 'ARTICLE_CRONS' AND cs."plan" IN ('PRO', 'PREMIUM'))
  OR (f."code" = 'SENTIMENT' AND cs."plan" = 'PREMIUM')
WHERE cs."deletedAt" IS NULL
ON CONFLICT ("clientSiteId", "featureId") DO NOTHING;
