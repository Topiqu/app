ALTER TABLE "public"."KnowledgeSource"
    ADD COLUMN "validAsOf" TIMESTAMP(3),
    ADD COLUMN "fetchedAt" TIMESTAMP(3),
    ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastUsedAt" TIMESTAMP(3);

UPDATE "public"."KnowledgeSource" SET "fetchedAt" = "createdAt" WHERE "kind" = 'URL';

CREATE INDEX "KnowledgeSource_kind_fetchedAt_idx" ON "public"."KnowledgeSource"("kind", "fetchedAt");
