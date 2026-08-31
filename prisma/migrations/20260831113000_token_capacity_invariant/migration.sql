-- Preserve historical top-ups under the capacity semantics, then repair invalid balances.
UPDATE "ClientSite"
SET
    "tokenLimit" = GREATEST(COALESCE("tokenLimit", 0), COALESCE("tokenRemaining", 0), 0),
    "tokenRemaining" = GREATEST(COALESCE("tokenRemaining", 0), 0);

ALTER TABLE "ClientSite"
    ADD CONSTRAINT "ClientSite_tokenLimit_nonnegative" CHECK ("tokenLimit" IS NULL OR "tokenLimit" >= 0),
    ADD CONSTRAINT "ClientSite_tokenRemaining_nonnegative" CHECK ("tokenRemaining" IS NULL OR "tokenRemaining" >= 0),
    ADD CONSTRAINT "ClientSite_tokenRemaining_within_capacity" CHECK (
        "tokenRemaining" IS NULL OR "tokenLimit" IS NULL OR "tokenRemaining" <= "tokenLimit"
    );
