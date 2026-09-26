CREATE TYPE "public"."ArticleGenerationSessionStatus" AS ENUM (
  'RESERVED', 'RESEARCHING', 'WRITING', 'FINALIZING', 'COMPLETED',
  'INTERRUPTED', 'FAILED', 'RESTORED', 'DISMISSED'
);

CREATE TABLE "public"."ArticleGenerationSession" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "attemptId" TEXT NOT NULL,
  "clientSiteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "articleOperationId" TEXT NOT NULL,
  "status" "public"."ArticleGenerationSessionStatus" NOT NULL DEFAULT 'RESERVED',
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "recoverableSnapshot" JSONB,
  "checkpoints" JSONB NOT NULL,
  "paidWorkStartedAt" TIMESTAMP(3),
  "usefulResultAt" TIMESTAMP(3),
  "lastCheckpointAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "charged" BOOLEAN NOT NULL DEFAULT false,
  "failureReason" TEXT,
  "restoredAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  CONSTRAINT "ArticleGenerationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArticleGenerationSession_attemptId_key" ON "public"."ArticleGenerationSession"("attemptId");
CREATE UNIQUE INDEX "ArticleGenerationSession_articleOperationId_key" ON "public"."ArticleGenerationSession"("articleOperationId");
CREATE INDEX "ArticleGenerationSession_userId_clientSiteId_createdAt_idx" ON "public"."ArticleGenerationSession"("userId", "clientSiteId", "createdAt");
CREATE INDEX "ArticleGenerationSession_clientSiteId_status_updatedAt_idx" ON "public"."ArticleGenerationSession"("clientSiteId", "status", "updatedAt");
ALTER TABLE "public"."ArticleGenerationSession" ADD CONSTRAINT "ArticleGenerationSession_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ArticleGenerationSession" ADD CONSTRAINT "ArticleGenerationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
