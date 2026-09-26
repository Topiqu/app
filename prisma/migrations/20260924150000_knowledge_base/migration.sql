-- Requires a Postgres build that ships pgvector (pgvector/pgvector:pg18-trixie, see docker-compose.yml).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is only STABLE, which a generated column refuses; pinning the dictionary makes it immutable.
CREATE OR REPLACE FUNCTION "public"."knowledge_unaccent"(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE TYPE "public"."KnowledgeSourceKind" AS ENUM ('NOTE', 'FILE', 'URL');
CREATE TYPE "public"."KnowledgeSourceStatus" AS ENUM ('PENDING', 'PROCESSING', 'INDEXED', 'FAILED');

CREATE TABLE "public"."KnowledgeSource" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "createdById" TEXT,
    "kind" "public"."KnowledgeSourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "public"."KnowledgeSourceStatus" NOT NULL DEFAULT 'PENDING',
    "useInArticles" BOOLEAN NOT NULL DEFAULT true,
    "publicUrl" TEXT,
    "sourceUrl" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "embeddingModel" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "indexedAt" TIMESTAMP(3),
    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "public"."knowledge_unaccent"("content"))) STORED,
    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeSource_clientSiteId_createdAt_idx" ON "public"."KnowledgeSource"("clientSiteId", "createdAt");
CREATE INDEX "KnowledgeSource_clientSiteId_contentHash_idx" ON "public"."KnowledgeSource"("clientSiteId", "contentHash");
CREATE INDEX "KnowledgeSource_status_updatedAt_idx" ON "public"."KnowledgeSource"("status", "updatedAt");
-- Exact per-tenant vector scan on purpose: a global HNSW index filters by tenant *after* the ANN
-- search and silently starves small tenants. See MAP.md → Knowledge.
CREATE INDEX "KnowledgeChunk_clientSiteId_idx" ON "public"."KnowledgeChunk"("clientSiteId");
CREATE INDEX "KnowledgeChunk_sourceId_version_idx" ON "public"."KnowledgeChunk"("sourceId", "version");
CREATE INDEX "KnowledgeChunk_searchVector_idx" ON "public"."KnowledgeChunk" USING GIN ("searchVector");

ALTER TABLE "public"."KnowledgeSource"
    ADD CONSTRAINT "KnowledgeSource_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "KnowledgeSource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
