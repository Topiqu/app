ALTER TYPE "KnowledgeSourceKind" ADD VALUE 'SHOPIFY';
ALTER TABLE "ShopifyConnection" ADD COLUMN "catalogRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "catalogSyncedRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KnowledgeSource" ADD COLUMN "shopifyConnectionId" TEXT;
CREATE UNIQUE INDEX "KnowledgeSource_shopifyConnectionId_key" ON "KnowledgeSource"("shopifyConnectionId");
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_shopifyConnectionId_fkey"
  FOREIGN KEY ("shopifyConnectionId") REFERENCES "ShopifyConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
