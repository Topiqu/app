-- Compatibility balance is read-only once a wallet exists. Old writers must fail loudly.
CREATE FUNCTION "check_wallet_projection"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE available INTEGER;
BEGIN
  SELECT "balance" - "reserved" INTO available FROM "TokenWallet" WHERE "id" = NEW."id";
  IF FOUND AND NEW."tokenRemaining" IS DISTINCT FROM available THEN
    RAISE EXCEPTION 'tokenRemaining is a wallet projection; use the wallet service';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ClientSite_wallet_projection" BEFORE UPDATE OF "tokenRemaining" ON "ClientSite"
FOR EACH ROW EXECUTE FUNCTION "check_wallet_projection"();
