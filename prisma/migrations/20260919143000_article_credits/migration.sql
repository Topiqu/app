CREATE TABLE "ArticleCreditWallet" (
    "id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArticleCreditWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArticleCreditGrant" (
    "id" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "policyVersion" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleCreditGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArticleCreditOperation" (
    "id" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "reserved" INTEGER NOT NULL DEFAULT 1,
    "charged" INTEGER NOT NULL DEFAULT 0,
    "allocations" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ArticleCreditOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArticleCreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "operationId" TEXT,
    "grantId" TEXT,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleCreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArticleCreditGrant_idempotencyKey_key" ON "ArticleCreditGrant"("idempotencyKey");
CREATE INDEX "ArticleCreditGrant_clientSiteId_expiresAt_idx" ON "ArticleCreditGrant"("clientSiteId", "expiresAt");
CREATE UNIQUE INDEX "ArticleCreditOperation_idempotencyKey_key" ON "ArticleCreditOperation"("idempotencyKey");
CREATE INDEX "ArticleCreditOperation_clientSiteId_createdAt_idx" ON "ArticleCreditOperation"("clientSiteId", "createdAt");
CREATE INDEX "ArticleCreditOperation_status_expiresAt_idx" ON "ArticleCreditOperation"("status", "expiresAt");
CREATE UNIQUE INDEX "ArticleCreditLedgerEntry_idempotencyKey_key" ON "ArticleCreditLedgerEntry"("idempotencyKey");
CREATE INDEX "ArticleCreditLedgerEntry_clientSiteId_createdAt_id_idx" ON "ArticleCreditLedgerEntry"("clientSiteId", "createdAt", "id");

ALTER TABLE "ArticleCreditWallet" ADD CONSTRAINT "ArticleCreditWallet_id_fkey" FOREIGN KEY ("id") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditGrant" ADD CONSTRAINT "ArticleCreditGrant_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ArticleCreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditOperation" ADD CONSTRAINT "ArticleCreditOperation_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ArticleCreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditLedgerEntry" ADD CONSTRAINT "ArticleCreditLedgerEntry_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ArticleCreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditLedgerEntry" ADD CONSTRAINT "ArticleCreditLedgerEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ArticleCreditOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleCreditLedgerEntry" ADD CONSTRAINT "ArticleCreditLedgerEntry_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "ArticleCreditGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArticleCreditWallet" ADD CONSTRAINT "ArticleCreditWallet_balance_nonnegative" CHECK ("balance" >= 0);
ALTER TABLE "ArticleCreditWallet" ADD CONSTRAINT "ArticleCreditWallet_reserved_nonnegative" CHECK ("reserved" >= 0);
ALTER TABLE "ArticleCreditWallet" ADD CONSTRAINT "ArticleCreditWallet_reserved_within_balance" CHECK ("reserved" <= "balance");
ALTER TABLE "ArticleCreditGrant" ADD CONSTRAINT "ArticleCreditGrant_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ArticleCreditGrant" ADD CONSTRAINT "ArticleCreditGrant_remaining_valid" CHECK ("remaining" >= 0 AND "remaining" <= "amount");
ALTER TABLE "ArticleCreditOperation" ADD CONSTRAINT "ArticleCreditOperation_counts_valid" CHECK ("reserved" = 1 AND "charged" >= 0 AND "charged" <= 1);

CREATE OR REPLACE FUNCTION reject_article_credit_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Article credit ledger is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ArticleCreditLedgerEntry_immutable_update"
BEFORE UPDATE ON "ArticleCreditLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION reject_article_credit_ledger_mutation();

CREATE TRIGGER "ArticleCreditLedgerEntry_immutable_delete"
BEFORE DELETE ON "ArticleCreditLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION reject_article_credit_ledger_mutation();
