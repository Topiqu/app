-- Drain older knowledge workers before deploying the staging writer. Existing products/chunks
-- remain untouched; only a fully embedded snapshot replaces them in one ownership-fenced commit.
CREATE TABLE "KnowledgeProductStage" (
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "embedding" vector(1536),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeProductStage_pkey" PRIMARY KEY ("sourceId", "externalId"),
    CONSTRAINT "KnowledgeProductStage_sourceId_fkey" FOREIGN KEY ("sourceId")
        REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
