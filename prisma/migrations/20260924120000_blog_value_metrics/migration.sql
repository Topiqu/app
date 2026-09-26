ALTER TABLE "public"."ArticleGenerationSession" ADD COLUMN "generatedWordCount" INTEGER;
ALTER TABLE "public"."Log" ADD COLUMN "idempotencyKey" TEXT;

CREATE INDEX "ArticleGenerationSession_clientSiteId_completedAt_idx" ON "public"."ArticleGenerationSession"("clientSiteId", "completedAt");
CREATE UNIQUE INDEX "Log_idempotencyKey_key" ON "public"."Log"("idempotencyKey");
CREATE INDEX "Log_clientSiteId_action_createdAt_idx" ON "public"."Log"("clientSiteId", "action", "createdAt");
