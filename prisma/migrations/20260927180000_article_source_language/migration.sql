-- Keep every existing article in its publication's current source language.
ALTER TABLE "Article" ADD COLUMN "language" "Language";

-- Older app replicas omit this column during a rolling deployment.
CREATE FUNCTION "article_source_language_default"() RETURNS trigger AS $$
BEGIN
  IF NEW."language" IS NULL THEN
    SELECT "language" INTO NEW."language" FROM "ClientSite" WHERE "id" = NEW."clientSiteId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "article_source_language_default"
BEFORE INSERT ON "Article"
FOR EACH ROW EXECUTE FUNCTION "article_source_language_default"();

UPDATE "Article" AS article
SET "language" = site."language"
FROM "ClientSite" AS site
WHERE article."clientSiteId" = site."id";

ALTER TABLE "Article" ALTER COLUMN "language" SET NOT NULL;

-- Older recovery drafts did not record which language tab was active.
ALTER TABLE "ArticleDraft" ADD COLUMN "language" "Language";
