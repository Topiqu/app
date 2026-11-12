-- Article credits and AI funding move from the blog to a billing account. Every existing blog gets a DIRECT
-- account with its own id, so ledger rows keep their values and only gain an owner column.
CREATE TYPE "BillingAccountKind" AS ENUM ('DIRECT', 'AGENCY');
CREATE TYPE "AgencyStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "BillingAccountRole" AS ENUM ('OWNER', 'MEMBER');

CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "kind" "BillingAccountKind" NOT NULL DEFAULT 'DIRECT',
    "directSiteId" TEXT,
    "name" TEXT,
    "status" "AgencyStatus" NOT NULL DEFAULT 'INACTIVE',
    "blogSlots" INTEGER NOT NULL DEFAULT 0 CHECK ("blogSlots" >= 0),
    "unitBlocks" INTEGER NOT NULL DEFAULT 0 CHECK ("unitBlocks" >= 0),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "billingCheckoutId" TEXT,
    "billingLeaseId" TEXT,
    "billingLeaseUntil" TIMESTAMP(3),
    "firstPaidAt" TIMESTAMP(3),
    "paidThrough" TIMESTAMP(3),
    "aiBudgetMonthlyMicros" INTEGER,
    "aiBudgetDebtMicros" INTEGER NOT NULL DEFAULT 0 CHECK ("aiBudgetDebtMicros" >= 0),
    "seoBudgetDebtMicros" INTEGER NOT NULL DEFAULT 0 CHECK ("seoBudgetDebtMicros" >= 0),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id"),
    -- A DIRECT account is the blog's own; an AGENCY account belongs to no single blog.
    CONSTRAINT "BillingAccount_kind_owner_check" CHECK (
        ("kind" = 'DIRECT' AND "directSiteId" = "id") OR ("kind" = 'AGENCY' AND "directSiteId" IS NULL)
    )
);

CREATE TABLE "BillingAccountMember" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BillingAccountRole" NOT NULL DEFAULT 'MEMBER',
    "scopes" "TenantScope"[],
    CONSTRAINT "BillingAccountMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingAccount_directSiteId_key" ON "BillingAccount"("directSiteId");
CREATE UNIQUE INDEX "BillingAccount_stripeSubscriptionId_key" ON "BillingAccount"("stripeSubscriptionId");
CREATE INDEX "BillingAccount_kind_status_idx" ON "BillingAccount"("kind", "status");
CREATE INDEX "BillingAccountMember_userId_idx" ON "BillingAccountMember"("userId");
CREATE UNIQUE INDEX "BillingAccountMember_accountId_userId_key" ON "BillingAccountMember"("accountId", "userId");

INSERT INTO "BillingAccount" ("id", "kind", "directSiteId", "updatedAt")
SELECT "id", 'DIRECT', "id", CURRENT_TIMESTAMP FROM "ClientSite";

-- Every blog owns its DIRECT account from the moment it exists, whichever code path inserts it.
CREATE FUNCTION "ClientSite_direct_billing_account"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO "BillingAccount" ("id", "kind", "directSiteId", "updatedAt")
    VALUES (NEW."id", 'DIRECT', NEW."id", CURRENT_TIMESTAMP)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

-- A blog that can be hard-deleted takes its unused account along; ledger rows still restrict both.
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_directSiteId_fkey"
    FOREIGN KEY ("directSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TRIGGER "ClientSite_direct_billing_account" AFTER INSERT ON "ClientSite"
    FOR EACH ROW EXECUTE FUNCTION "ClientSite_direct_billing_account"();
ALTER TABLE "BillingAccountMember" ADD CONSTRAINT "BillingAccountMember_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingAccountMember" ADD CONSTRAINT "BillingAccountMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientSite"
    ADD COLUMN "billingAccountId" TEXT,
    ADD COLUMN "monthlyUnitLimit" INTEGER CHECK ("monthlyUnitLimit" > 0);
CREATE INDEX "ClientSite_billingAccountId_idx" ON "ClientSite"("billingAccountId");
ALTER TABLE "ClientSite" ADD CONSTRAINT "ClientSite_billingAccountId_fkey"
    FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TenantMembership" ADD COLUMN "billingAccountId" TEXT;
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_billingAccountId_fkey"
    FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The wallet's id is now its account's id; the values do not change.
ALTER TABLE "ArticleCreditWallet" DROP CONSTRAINT "ArticleCreditWallet_id_fkey";
ALTER TABLE "ArticleCreditWallet" ADD CONSTRAINT "ArticleCreditWallet_id_fkey"
    FOREIGN KEY ("id") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArticleCreditGrant" DROP CONSTRAINT "ArticleCreditGrant_clientSiteId_fkey";
ALTER TABLE "ArticleCreditOperation" DROP CONSTRAINT "ArticleCreditOperation_clientSiteId_fkey";
ALTER TABLE "ArticleCreditLedgerEntry" DROP CONSTRAINT "ArticleCreditLedgerEntry_clientSiteId_fkey";

ALTER TABLE "ArticleCreditGrant" ADD COLUMN "accountId" TEXT;
ALTER TABLE "ArticleCreditOperation" ADD COLUMN "accountId" TEXT;
ALTER TABLE "ArticleCreditLedgerEntry" ADD COLUMN "accountId" TEXT;
ALTER TABLE "AiAllowanceGrant" ADD COLUMN "accountId" TEXT;
ALTER TABLE "AiAllowanceInvoice" ADD COLUMN "accountId" TEXT;
ALTER TABLE "AiUsageReservation" ADD COLUMN "accountId" TEXT;
UPDATE "ArticleCreditGrant" SET "accountId" = "clientSiteId";
UPDATE "ArticleCreditOperation" SET "accountId" = "clientSiteId";
-- The immutability trigger guards amounts; the owner it gains here is a copy of a column already stored.
ALTER TABLE "ArticleCreditLedgerEntry" DISABLE TRIGGER "ArticleCreditLedgerEntry_immutable_update";
UPDATE "ArticleCreditLedgerEntry" SET "accountId" = "clientSiteId";
ALTER TABLE "ArticleCreditLedgerEntry" ENABLE TRIGGER "ArticleCreditLedgerEntry_immutable_update";
UPDATE "AiAllowanceGrant" SET "accountId" = "clientSiteId";
UPDATE "AiAllowanceInvoice" SET "accountId" = "clientSiteId";
UPDATE "AiUsageReservation" SET "accountId" = "clientSiteId";
ALTER TABLE "ArticleCreditGrant" ALTER COLUMN "accountId" SET NOT NULL, ALTER COLUMN "clientSiteId" DROP NOT NULL;
ALTER TABLE "ArticleCreditOperation" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "ArticleCreditLedgerEntry" ALTER COLUMN "accountId" SET NOT NULL, ALTER COLUMN "clientSiteId" DROP NOT NULL;
ALTER TABLE "AiAllowanceGrant" ALTER COLUMN "accountId" SET NOT NULL, ALTER COLUMN "clientSiteId" DROP NOT NULL;
ALTER TABLE "AiAllowanceInvoice" ALTER COLUMN "accountId" SET NOT NULL, ALTER COLUMN "clientSiteId" DROP NOT NULL;
ALTER TABLE "AiUsageReservation" ALTER COLUMN "accountId" SET NOT NULL;

ALTER TABLE "ArticleCreditGrant" ADD CONSTRAINT "ArticleCreditGrant_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "ArticleCreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditGrant" ADD CONSTRAINT "ArticleCreditGrant_clientSiteId_fkey"
    FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditOperation" ADD CONSTRAINT "ArticleCreditOperation_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "ArticleCreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditOperation" ADD CONSTRAINT "ArticleCreditOperation_clientSiteId_fkey"
    FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditLedgerEntry" ADD CONSTRAINT "ArticleCreditLedgerEntry_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "ArticleCreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditLedgerEntry" ADD CONSTRAINT "ArticleCreditLedgerEntry_clientSiteId_fkey"
    FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiAllowanceGrant" ADD CONSTRAINT "AiAllowanceGrant_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiAllowanceInvoice" ADD CONSTRAINT "AiAllowanceInvoice_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiUsageReservation" ADD CONSTRAINT "AiUsageReservation_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "ArticleCreditGrant_clientSiteId_expiresAt_idx";
DROP INDEX "AiAllowanceGrant_clientSiteId_kind_expiresAt_idx";
DROP INDEX "AiAllowanceInvoice_clientSiteId_createdAt_idx";
DROP INDEX "AiUsageReservation_clientSiteId_status_expiresAt_idx";
CREATE INDEX "ArticleCreditGrant_accountId_expiresAt_idx" ON "ArticleCreditGrant"("accountId", "expiresAt");
CREATE INDEX "ArticleCreditGrant_clientSiteId_idx" ON "ArticleCreditGrant"("clientSiteId");
CREATE INDEX "ArticleCreditOperation_accountId_createdAt_idx" ON "ArticleCreditOperation"("accountId", "createdAt");
CREATE INDEX "ArticleCreditLedgerEntry_accountId_createdAt_id_idx" ON "ArticleCreditLedgerEntry"("accountId", "createdAt", "id");
CREATE INDEX "AiAllowanceGrant_accountId_kind_expiresAt_idx" ON "AiAllowanceGrant"("accountId", "kind", "expiresAt");
CREATE INDEX "AiAllowanceGrant_clientSiteId_idx" ON "AiAllowanceGrant"("clientSiteId");
CREATE INDEX "AiAllowanceInvoice_accountId_createdAt_idx" ON "AiAllowanceInvoice"("accountId", "createdAt");
CREATE INDEX "AiAllowanceInvoice_clientSiteId_idx" ON "AiAllowanceInvoice"("clientSiteId");
CREATE INDEX "AiUsageReservation_accountId_status_expiresAt_idx" ON "AiUsageReservation"("accountId", "status", "expiresAt");
CREATE INDEX "AiUsageReservation_clientSiteId_createdAt_idx" ON "AiUsageReservation"("clientSiteId", "createdAt");
