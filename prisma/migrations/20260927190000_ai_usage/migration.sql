-- Deploy with application workers stopped: old instances still write to the token wallet.
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiUsage_clientSiteId_createdAt_idx" ON "AiUsage"("clientSiteId", "createdAt");
CREATE INDEX "AiUsage_action_createdAt_idx" ON "AiUsage"("action", "createdAt");
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_clientSiteId_fkey"
    FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Measured usage is the only part of the wallet that carried information; balances and grants did not.
INSERT INTO "AiUsage" ("id", "clientSiteId", "action", "tokens", "metadata", "createdAt")
SELECT
    "id",
    "clientSiteId",
    COALESCE("metadata"->>'action', "action"),
    CASE WHEN "metadata"->>'apiTokens' ~ '^[0-9]{1,9}$' THEN ("metadata"->>'apiTokens')::INTEGER ELSE "actual" END,
    "metadata",
    COALESCE("completedAt", "createdAt")
FROM "TokenOperation"
WHERE "status" = 'COMPLETED' AND "action" <> 'ADMIN_DEBIT' AND "actual" > 0;

DROP TRIGGER IF EXISTS "ClientSite_wallet_projection" ON "ClientSite";
DROP FUNCTION IF EXISTS "check_wallet_projection"();
DROP TABLE "TokenLedgerEntry";
DROP FUNCTION IF EXISTS "reject_token_ledger_mutation"();
DROP TABLE "TokenOperation";
DROP TABLE "TokenCreditGrant";
DROP TABLE "TokenWallet";

ALTER TABLE "ClientSite" DROP CONSTRAINT IF EXISTS "ClientSite_tokenRemaining_nonnegative";
ALTER TABLE "ClientSite"
    DROP COLUMN "tokenRemaining",
    DROP COLUMN "totalUsage",
    DROP COLUMN "lastTokenRefilled";
