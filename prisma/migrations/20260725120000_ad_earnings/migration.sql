-- Ad revenue ledger. One immutable-ish row per (clientSiteId, periodStart, periodEnd):
-- the GAM sync upserts it, so re-running a day corrects the numbers without duplicating.
-- shareRatio is snapshotted per row on purpose — a later plan change must not retroactively
-- rewrite what a site already earned. Money is stored as integer cents (never floats).
-- Payout state lives here too so the future payout rail has an idempotency anchor (payoutRef).

-- CreateEnum
CREATE TYPE "AdPayoutStatus" AS ENUM ('PENDING', 'PAYABLE', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "AdEarning" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "plan" "ClientPlan" NOT NULL,
    "shareRatio" DOUBLE PRECISION NOT NULL,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "clientCents" INTEGER NOT NULL DEFAULT 0,
    "platformCents" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'GAM',
    "payoutStatus" "AdPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payoutRef" TEXT,

    CONSTRAINT "AdEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdEarning_payoutStatus_idx" ON "AdEarning"("payoutStatus");

-- CreateIndex
CREATE INDEX "AdEarning_clientSiteId_periodStart_idx" ON "AdEarning"("clientSiteId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "AdEarning_clientSiteId_periodStart_periodEnd_key" ON "AdEarning"("clientSiteId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "AdEarning" ADD CONSTRAINT "AdEarning_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
