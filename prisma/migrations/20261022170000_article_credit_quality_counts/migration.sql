-- Quality-priced articles reserve multiple credits while older operations remain valid.
ALTER TABLE "ArticleCreditOperation"
DROP CONSTRAINT "ArticleCreditOperation_counts_valid",
ADD CONSTRAINT "ArticleCreditOperation_counts_valid"
CHECK ("reserved" > 0 AND "charged" >= 0 AND "charged" <= "reserved");
