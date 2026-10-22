BEGIN;

ALTER TABLE "Article" ADD COLUMN "editVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN "origin" TEXT;

CREATE TABLE "ArticleRevision" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArticleRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArticleRevision_articleId_version_key" ON "ArticleRevision"("articleId", "version");
CREATE INDEX "ArticleRevision_clientSiteId_articleId_createdAt_idx" ON "ArticleRevision"("clientSiteId", "articleId", "createdAt");

CREATE TABLE "SystemTaskStatus" (
    "name" TEXT NOT NULL,
    "runId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "lastSucceededAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "processed" INTEGER,
    "failed" INTEGER,
    "skipped" INTEGER,
    CONSTRAINT "SystemTaskStatus_pkey" PRIMARY KEY ("name")
);

-- A database trigger covers editor, automation and maintenance writes equally.
-- Views, analytics, and timestamps cannot invalidate an editor's content version.
CREATE FUNCTION topiqu_article_revision() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    keys TEXT[] := ARRAY['title', 'excerpt', 'content', 'slug', 'language', 'imageUrl',
        'imageCredit', 'coverMediaId', 'status', 'releaseAt', 'allowedComments',
        'answer', 'keyTakeaways', 'faq', 'sources', 'format', 'structureVariant',
        'prompt', 'articleSeriesId', 'seriesOrder', 'aiInvolvement'];
    previous JSONB;
    following JSONB;
BEGIN
    SELECT jsonb_object_agg(key, value) INTO previous FROM jsonb_each(to_jsonb(OLD)) WHERE key = ANY(keys);
    SELECT jsonb_object_agg(key, value) INTO following FROM jsonb_each(to_jsonb(NEW)) WHERE key = ANY(keys);
    IF previous IS DISTINCT FROM following OR current_setting('topiqu.tags_changed_article_id', true) = OLD.id THEN
        previous := previous || jsonb_build_object('tagIds', (
            SELECT coalesce(jsonb_agg("tagId" ORDER BY "tagId"), '[]'::jsonb) FROM "ArticleTag" WHERE "articleId" = OLD.id
        ));
        INSERT INTO "ArticleRevision" ("id", "articleId", "clientSiteId", "version", "title", "snapshot", "actorId", "actorName")
        VALUES (gen_random_uuid()::text, OLD.id, OLD."clientSiteId", OLD."editVersion", OLD.title, previous,
            nullif(current_setting('topiqu.actor_id', true), ''),
            nullif(current_setting('topiqu.actor_name', true), ''));
        NEW."editVersion" := OLD."editVersion" + 1;
        DELETE FROM "ArticleRevision" WHERE "articleId" = OLD.id AND "version" IN (
            SELECT "version" FROM "ArticleRevision" WHERE "articleId" = OLD.id ORDER BY "version" DESC OFFSET 50
        );
    ELSE
        NEW."editVersion" := OLD."editVersion";
    END IF;
    RETURN NEW;
END;
$$;
-- View/share counters are hot paths: do not serialize article bodies for those writes.
CREATE TRIGGER "Article_revision_before_update" BEFORE UPDATE OF
    "title", "excerpt", "content", "slug", "language", "imageUrl", "imageCredit", "coverMediaId",
    "status", "releaseAt", "allowedComments", "answer", "keyTakeaways", "faq", "sources", "format",
    "structureVariant", "prompt", "articleSeriesId", "seriesOrder", "aiInvolvement", "editVersion" ON "Article"
FOR EACH ROW EXECUTE FUNCTION topiqu_article_revision();

COMMIT;
