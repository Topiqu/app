BEGIN;

-- DataForSEO moves out of the AI budget into its own SEO guard.
ALTER TABLE "AiAllowanceGrant" DROP CONSTRAINT "AiAllowanceGrant_kind_check",
    ADD CONSTRAINT "AiAllowanceGrant_kind_check" CHECK ("kind" IN ('BUDGET', 'SEO', 'TRANSLATION', 'EDIT', 'VISIBILITY'));
ALTER TABLE "AiUsageReservation" DROP CONSTRAINT "AiUsageReservation_kind_check",
    ADD CONSTRAINT "AiUsageReservation_kind_check" CHECK ("kind" IN ('BUDGET', 'SEO', 'TRANSLATION', 'EDIT', 'VISIBILITY'));

-- The AI cost cap rises from 15 % to 50 % of the net plan price (x 10/3). Plan and trial grants top up
-- lazily through the new policy key; invoice-funded grants of running periods are scaled here.
UPDATE "ClientSite"
SET "aiBudgetMonthlyMicros" = LEAST(2000000000, ("aiBudgetMonthlyMicros"::BIGINT * 10 / 3))::INTEGER
WHERE "aiBudgetMonthlyMicros" IS NOT NULL;

WITH scaled AS (
    SELECT "id", LEAST(2000000000, ("amount"::BIGINT * 10 / 3))::INTEGER AS "next"
    FROM "AiAllowanceGrant"
    WHERE "kind" = 'BUDGET'
      AND "source" IN ('PAID_BASE_BUDGET', 'PAID_BUDGET')
      AND "expiresAt" > CURRENT_TIMESTAMP
)
UPDATE "AiAllowanceGrant" AS grant_row
SET "remaining" = grant_row."remaining" + (scaled."next" - grant_row."amount"),
    "amount" = scaled."next"
FROM scaled
WHERE grant_row."id" = scaled."id";

UPDATE "AiAllowanceInvoice" AS invoice
SET "grantedMicros" = grant_row."amount"
FROM "AiAllowanceGrant" AS grant_row
WHERE grant_row."idempotencyKey" = 'ai-invoice:' || invoice."id"
  AND grant_row."expiresAt" > CURRENT_TIMESTAMP;

COMMIT;
