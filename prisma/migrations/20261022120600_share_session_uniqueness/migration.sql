-- Keep this one statement: Prisma's multi-statement SQL uses an implicit transaction,
-- while CONCURRENTLY must run outside one. Historical indexes and all rows remain intact.
CREATE UNIQUE INDEX CONCURRENTLY "ArticleShare_articleId_platform_sessionId_key" ON "ArticleShare"("articleId", "platform", "sessionId");
