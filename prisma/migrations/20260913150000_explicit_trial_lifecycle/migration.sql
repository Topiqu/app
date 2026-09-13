ALTER TABLE "ClientSite"
ADD COLUMN "trialStartedAt" TIMESTAMP(3),
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "trialAcknowledgedAt" TIMESTAMP(3);

-- Only an issued trial grant proves that a historical tenant actually entered the trial.
-- Plan/Stripe/payment nullability is not sufficient: manually provisioned PREMIUM sites share it.
UPDATE "ClientSite" AS site
SET "trialStartedAt" = trial."startedAt",
    "trialEndsAt" = trial."endsAt"
FROM (
  SELECT
    "clientSiteId",
    MIN("createdAt") AS "startedAt",
    MIN(COALESCE("expiresAt", "createdAt" + INTERVAL '14 days')) AS "endsAt"
  FROM "TokenCreditGrant"
  WHERE "source" = 'TRIAL'
  GROUP BY "clientSiteId"
) AS trial
WHERE site."id" = trial."clientSiteId";

CREATE INDEX "ClientSite_trialEndsAt_trialAcknowledgedAt_idx"
ON "ClientSite" ("trialEndsAt", "trialAcknowledgedAt");
