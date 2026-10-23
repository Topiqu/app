-- Additive leases; no status enum or historical report/comment data is rewritten.
-- Drain old task workers before rollout because old binaries do not honor these claims.
ALTER TABLE "Comment"
    ADD COLUMN "sentimentClaimToken" TEXT,
    ADD COLUMN "sentimentClaimedAt" TIMESTAMP(3),
    ADD COLUMN "sentimentAttempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ClientSite"
    ADD COLUMN "insightClaimToken" TEXT,
    ADD COLUMN "insightClaimedAt" TIMESTAMP(3),
    ADD COLUMN "insightAttemptedAt" TIMESTAMP(3),
    ADD COLUMN "insightAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "insightNextAttemptAt" TIMESTAMP(3),
    ADD COLUMN "insightError" TEXT;
