-- Subject-area labels the scheduler balances across recent articles; NULL for legacy and manual work.
ALTER TABLE "KeywordCluster" ADD COLUMN "theme" TEXT;
ALTER TABLE "Article" ADD COLUMN "theme" TEXT;
