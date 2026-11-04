BEGIN;

ALTER TABLE "ArticleTranslation" ADD COLUMN "aiRetryAt" TIMESTAMP(3);

ALTER TABLE "ClientSite"
    ADD COLUMN "paidTeamSeats" INTEGER,
    ADD COLUMN "billingLeaseId" TEXT,
    ADD COLUMN "billingLeaseUntil" TIMESTAMP(3),
    ADD COLUMN "monthlyPaymentCents" INTEGER,
    ADD COLUMN "annualPaymentCents" INTEGER,
    ADD COLUMN "aiBudgetMonthlyMicros" INTEGER,
    ADD COLUMN "aiBudgetDebtMicros" INTEGER NOT NULL DEFAULT 0 CHECK ("aiBudgetDebtMicros" >= 0),
    ADD CONSTRAINT "ClientSite_paidTeamSeats_check" CHECK ("paidTeamSeats" IS NULL OR "paidTeamSeats" BETWEEN 3 AND 1000),
    ADD CONSTRAINT "ClientSite_aiBudgetMonthlyMicros_check" CHECK ("aiBudgetMonthlyMicros" IS NULL OR "aiBudgetMonthlyMicros" >= 0);

CREATE TABLE "AiAllowanceGrant" (
    "id" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL CHECK ("amount" > 0),
    "remaining" INTEGER NOT NULL CHECK ("remaining" >= 0 AND "remaining" <= "amount"),
    "periodStart" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAllowanceGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiAllowanceGrant_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AiAllowanceGrant_kind_check" CHECK ("kind" IN ('BUDGET', 'TRANSLATION', 'EDIT', 'VISIBILITY'))
);
CREATE UNIQUE INDEX "AiAllowanceGrant_idempotencyKey_key" ON "AiAllowanceGrant"("idempotencyKey");
CREATE INDEX "AiAllowanceGrant_clientSiteId_kind_expiresAt_idx" ON "AiAllowanceGrant"("clientSiteId", "kind", "expiresAt");

CREATE TABLE "AiUsageReservation" (
    "id" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reserved" INTEGER NOT NULL CHECK ("reserved" > 0),
    "charged" INTEGER CHECK ("charged" >= 0),
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "allocations" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AiUsageReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiUsageReservation_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AiUsageReservation_kind_check" CHECK ("kind" IN ('BUDGET', 'TRANSLATION', 'EDIT', 'VISIBILITY')),
    CONSTRAINT "AiUsageReservation_status_check" CHECK ("status" IN ('RESERVED', 'COMPLETED', 'FAILED', 'UNKNOWN'))
);
CREATE INDEX "AiUsageReservation_clientSiteId_status_expiresAt_idx" ON "AiUsageReservation"("clientSiteId", "status", "expiresAt");

COMMIT;
