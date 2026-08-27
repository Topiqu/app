-- A compact editorial-memory key; article modules remain derivable from the article itself.
ALTER TABLE "Article" ADD COLUMN "structureVariant" TEXT;
