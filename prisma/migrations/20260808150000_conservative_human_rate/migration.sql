-- 60 USD/h was above every published copywriter median, so "money saved" overstated the case.
-- 35 sits just under BLS OEWS 27-3043 ($36.98/h) and the salary aggregators — see
-- `shared/utils/savings.ts`, which has to stay in sync with this default.
ALTER TABLE "ClientSite" ALTER COLUMN "humanHourlyRateUsd" SET DEFAULT 35;

-- Same trade-off as the rename migration: a tenant sitting on exactly the old default is
-- indistinguishable from one that typed 60, and both are better served by the defensible number.
UPDATE "ClientSite" SET "humanHourlyRateUsd" = 35 WHERE "humanHourlyRateUsd" = 60;
