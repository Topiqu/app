-- Deploy with application workers stopped: legacy writers must not bypass the ledger.
DROP TRIGGER IF EXISTS "ClientSite_normalize_token_capacity" ON "ClientSite";
DROP FUNCTION IF EXISTS "normalize_client_site_token_capacity"();
ALTER TABLE "ClientSite" DROP CONSTRAINT IF EXISTS "ClientSite_tokenRemaining_within_capacity";
ALTER TABLE "ClientSite" DROP COLUMN "tokenLimit";

CREATE TABLE "TokenWallet" (
 "id" TEXT PRIMARY KEY, "balance" INTEGER NOT NULL DEFAULT 0, "reserved" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK ("balance" >= 0 AND "reserved" >= 0 AND "reserved" <= "balance")
);
CREATE TABLE "TokenCreditGrant" (
 "id" TEXT PRIMARY KEY, "clientSiteId" TEXT NOT NULL, "source" TEXT NOT NULL,
 "amount" INTEGER NOT NULL CHECK ("amount" > 0), "remaining" INTEGER NOT NULL,
 "expiresAt" TIMESTAMP(3), "idempotencyKey" TEXT NOT NULL UNIQUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("remaining" >= 0 AND "remaining" <= "amount")
);
CREATE INDEX "TokenCreditGrant_clientSiteId_expiresAt_idx" ON "TokenCreditGrant"("clientSiteId", "expiresAt");
CREATE TABLE "TokenOperation" (
 "id" TEXT PRIMARY KEY, "clientSiteId" TEXT NOT NULL, "action" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'RESERVED', "reserved" INTEGER NOT NULL,
 "charged" INTEGER NOT NULL DEFAULT 0, "actual" INTEGER NOT NULL DEFAULT 0,
 "allocations" JSONB NOT NULL, "metadata" JSONB NOT NULL, "priceVersion" TEXT NOT NULL,
 "idempotencyKey" TEXT NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
 CHECK ("reserved" > 0 AND "charged" >= 0 AND "charged" <= "reserved" AND "actual" >= 0)
);
CREATE INDEX "TokenOperation_clientSiteId_createdAt_idx" ON "TokenOperation"("clientSiteId", "createdAt");
CREATE INDEX "TokenOperation_status_expiresAt_idx" ON "TokenOperation"("status", "expiresAt");
CREATE TABLE "TokenLedgerEntry" (
 "id" TEXT PRIMARY KEY, "clientSiteId" TEXT NOT NULL, "kind" TEXT NOT NULL, "amount" INTEGER NOT NULL,
 "operationId" TEXT, "grantId" TEXT, "actorId" TEXT, "reason" TEXT NOT NULL,
 "idempotencyKey" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TokenLedgerEntry_clientSiteId_createdAt_id_idx" ON "TokenLedgerEntry"("clientSiteId", "createdAt", "id");

INSERT INTO "TokenWallet" ("id", "balance", "updatedAt")
 SELECT "id", GREATEST(0, COALESCE("tokenRemaining", 0)), CURRENT_TIMESTAMP FROM "ClientSite";
INSERT INTO "TokenCreditGrant" ("id", "clientSiteId", "source", "amount", "remaining", "idempotencyKey")
 SELECT 'opening:' || "id", "id", 'MIGRATION', "balance", "balance", 'opening:' || "id"
 FROM "TokenWallet" WHERE "balance" > 0;

-- Financial history is append-only, including for privileged application users.
CREATE FUNCTION "reject_token_ledger_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Token ledger is immutable; create a compensating entry';
END;
$$;
CREATE TRIGGER "TokenLedgerEntry_immutable" BEFORE UPDATE OR DELETE ON "TokenLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "reject_token_ledger_mutation"();
INSERT INTO "TokenLedgerEntry" ("id", "clientSiteId", "kind", "amount", "grantId", "reason", "idempotencyKey")
 SELECT 'opening:' || "id", "id", 'CREDIT', "balance", 'opening:' || "id", 'Opening balance', 'opening:' || "id"
 FROM "TokenWallet" WHERE "balance" > 0;
