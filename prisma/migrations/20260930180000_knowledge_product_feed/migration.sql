ALTER TYPE "public"."KnowledgeSourceKind" ADD VALUE 'FEED';

CREATE TYPE "public"."KnowledgeProductAvailability" AS ENUM ('IN_STOCK', 'PREORDER', 'BACKORDER', 'OUT_OF_STOCK');

ALTER TABLE "public"."KnowledgeSource"
    ADD COLUMN "language" "public"."Language",
    ADD COLUMN "currency" TEXT,
    ADD COLUMN "syncReport" JSONB;

CREATE TABLE "public"."KnowledgeProduct" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "sourceId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "currency" TEXT,
    "availability" "public"."KnowledgeProductAvailability" NOT NULL,
    "textHash" TEXT,
    CONSTRAINT "KnowledgeProduct_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."KnowledgeChunk" ADD COLUMN "productId" TEXT;

CREATE UNIQUE INDEX "KnowledgeProduct_sourceId_externalId_key" ON "public"."KnowledgeProduct"("sourceId", "externalId");
CREATE INDEX "KnowledgeProduct_clientSiteId_idx" ON "public"."KnowledgeProduct"("clientSiteId");
CREATE INDEX "KnowledgeChunk_productId_idx" ON "public"."KnowledgeChunk"("productId");

ALTER TABLE "public"."KnowledgeProduct"
    ADD CONSTRAINT "KnowledgeProduct_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."KnowledgeProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
