-- Per-step progress of a website import, shown live in settings.
ALTER TABLE "WebsiteImport" ADD COLUMN "progress" JSONB;
