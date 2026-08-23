-- Feature gating had three unsynchronized sources of truth: ClientFeature rows (what the
-- settings panel rendered), ClientSite.enableAi/enableCron/enableSentiment (what the
-- translation endpoint and cron actually checked, written only at onboarding), and bare
-- plan checks (sentiment cron). A PREMIUM tenant therefore saw every feature switched off
-- while the app happily generated, translated and analysed. ClientFeature is now the only
-- source; this migration backfills it from the plan matrix and drops the dead booleans.
--
-- Backfill mirrors getAllowedFeatures() in server/utils/planFeatures.ts:
--   AI            -> PRO, PREMIUM
--   ARTICLE_CRONS -> PRO, PREMIUM
--   SENTIMENT     -> PREMIUM
-- CUSTOM is deliberately excluded: it is the à-la-carte plan, where operators pick features
-- by hand and billingLockedUntil carries real billing weight. Backfilled rows get
-- billingLockedUntil = now() (no lock) because billableMonthlyTotal() bills nothing outside
-- CUSTOM — these features are included in the plan, not charged per item.

INSERT INTO "ClientFeature" (
    "id",
    "createdAt",
    "updatedAt",
    "clientSiteId",
    "featureId",
    "activatedAt",
    "billingLockedUntil",
    "isActive"
)
SELECT
    gen_random_uuid()::text,
    now(),
    now(),
    cs."id",
    f."id",
    now(),
    now(),
    true
FROM "ClientSite" cs
JOIN "Feature" f
    ON (f."code" = 'AI' AND cs."plan" IN ('PRO', 'PREMIUM'))
    OR (f."code" = 'ARTICLE_CRONS' AND cs."plan" IN ('PRO', 'PREMIUM'))
    OR (f."code" = 'SENTIMENT' AND cs."plan" = 'PREMIUM')
WHERE cs."deletedAt" IS NULL
ON CONFLICT ("clientSiteId", "featureId") DO NOTHING;

-- A site that had been toggled off by hand keeps that choice; only rows the backfill just
-- created (or that were already active) count. Reactivate nothing that was explicitly
-- deactivated — the ON CONFLICT above already skips those.

-- DropIndex
DROP INDEX IF EXISTS "ClientSite_domain_name_plan_billingPlan_enableAi_enableCron_idx";

-- AlterTable
ALTER TABLE "ClientSite"
    DROP COLUMN "enableAi",
    DROP COLUMN "enableCron",
    DROP COLUMN "enableSentiment";

-- CreateIndex
CREATE INDEX "ClientSite_domain_name_plan_billingPlan_idx" ON "ClientSite"("domain", "name", "plan", "billingPlan");
