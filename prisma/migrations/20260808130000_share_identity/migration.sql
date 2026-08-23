-- ArticleShare recorded no identity, so one visitor could stack the counter without limit
-- (copy-link most easily). Mirrors ArticleReaction: a session user, or the client fingerprint
-- for anonymous visitors.
ALTER TABLE "ArticleShare"
    ADD COLUMN "userId" TEXT,
    ADD COLUMN "sessionId" TEXT;

ALTER TABLE "ArticleShare"
    ADD CONSTRAINT "ArticleShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backstop only. Postgres treats NULLs as distinct, and every row here carries at least one
-- NULL (a user row has no sessionId and vice versa), so this catches nothing on its own —
-- the handler's lookup is what enforces one row per identity, exactly as ArticleReaction does.
CREATE UNIQUE INDEX "ArticleShare_articleId_platform_userId_sessionId_key"
    ON "ArticleShare"("articleId", "platform", "userId", "sessionId");
