-- Keep the capacity invariant compatible with an older application instance during a rolling
-- deployment. Legacy code may still decrement below zero or top up only tokenRemaining; normalize
-- those writes before the CHECK constraints from the previous migration are evaluated.
CREATE OR REPLACE FUNCTION "normalize_client_site_token_capacity"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."tokenRemaining" := GREATEST(COALESCE(NEW."tokenRemaining", 0), 0);
    NEW."tokenLimit" := GREATEST(COALESCE(NEW."tokenLimit", 0), NEW."tokenRemaining", 0);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ClientSite_normalize_token_capacity" ON "ClientSite";

CREATE TRIGGER "ClientSite_normalize_token_capacity"
BEFORE INSERT OR UPDATE OF "tokenLimit", "tokenRemaining" ON "ClientSite"
FOR EACH ROW
EXECUTE FUNCTION "normalize_client_site_token_capacity"();

-- Re-run the repair in case this follows a partially rolled-out application release.
UPDATE "ClientSite"
SET
    "tokenRemaining" = GREATEST(COALESCE("tokenRemaining", 0), 0),
    "tokenLimit" = GREATEST(COALESCE("tokenLimit", 0), COALESCE("tokenRemaining", 0), 0);
