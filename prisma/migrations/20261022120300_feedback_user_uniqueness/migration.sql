-- Keep this one statement: Prisma's multi-statement SQL uses an implicit transaction,
-- while CONCURRENTLY must run outside one. Historical indexes and all rows remain intact.
CREATE UNIQUE INDEX CONCURRENTLY "ArticleFeedback_articleId_userId_key" ON "ArticleFeedback"("articleId", "userId");
