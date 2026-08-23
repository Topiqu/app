-- Which shape the generator picked, so the topic picker can avoid repeating it.
-- No index: the cron reads it through the existing newest-first relation load, not a new query.
ALTER TABLE "Article" ADD COLUMN "format" TEXT;
