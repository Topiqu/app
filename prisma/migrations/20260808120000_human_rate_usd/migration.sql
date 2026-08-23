-- `humanHourlyRate` held a CZK figure but the stats dialog rendered it through Intl with the
-- tenant's `currency` (default USD), so "money saved" read ~23x too high. Rebase on USD, which
-- is what every other money column on the platform stores.
ALTER TABLE "ClientSite" RENAME COLUMN "humanHourlyRate" TO "humanHourlyRateUsd";
ALTER TABLE "ClientSite" ALTER COLUMN "humanHourlyRateUsd" SET DEFAULT 60;

-- Only rows still sitting on the old default: a tenant that deliberately set its own rate
-- keeps it (and is expected to re-enter it in USD).
UPDATE "ClientSite" SET "humanHourlyRateUsd" = 60 WHERE "humanHourlyRateUsd" = 1400;
