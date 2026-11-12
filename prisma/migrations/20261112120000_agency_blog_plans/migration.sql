-- An agency picks each blog's plan: BASIC (paused, free), PRO, or PREMIUM on a paid add-on.
ALTER TABLE "BillingAccount" ADD COLUMN "premiumSlots" INTEGER NOT NULL DEFAULT 0 CHECK ("premiumSlots" >= 0);

ALTER TABLE "ClientSite" ADD COLUMN "agencyPlan" "ClientPlan";
UPDATE "ClientSite" SET "agencyPlan" = 'PRO' WHERE "billingAccountId" IS NOT NULL;
ALTER TABLE "ClientSite" ADD CONSTRAINT "ClientSite_agencyPlan_check" CHECK (
    ("billingAccountId" IS NULL AND "agencyPlan" IS NULL)
    OR ("billingAccountId" IS NOT NULL AND "agencyPlan" IN ('BASIC', 'PRO', 'PREMIUM'))
);
