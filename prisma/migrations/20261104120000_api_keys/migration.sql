-- API keys are stored as SHA-256 hashes and shown once. The single plaintext ClientSite key becomes a
-- read-only ApiKey with the same hash, so existing integrations (WordPress plugin) keep working.
CREATE TYPE "public"."ApiKeyScope" AS ENUM ('READ', 'WRITE', 'PUBLISH', 'GENERATE');
CREATE TYPE "public"."ApiGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

ALTER TYPE "public"."WebhookEvent" ADD VALUE IF NOT EXISTS 'GENERATION_SUCCEEDED';
ALTER TYPE "public"."WebhookEvent" ADD VALUE IF NOT EXISTS 'GENERATION_FAILED';

CREATE TABLE "public"."ApiKey" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "scopes" "public"."ApiKeyScope"[],
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ApiIdempotencyKey" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiIdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ApiGeneration" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "topic" TEXT NOT NULL,
    "instructions" TEXT,
    "status" "public"."ApiGenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "articleId" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "ApiGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_hash_key" ON "public"."ApiKey"("hash");
CREATE INDEX "ApiKey_clientSiteId_idx" ON "public"."ApiKey"("clientSiteId");
CREATE UNIQUE INDEX "ApiIdempotencyKey_apiKeyId_key_key" ON "public"."ApiIdempotencyKey"("apiKeyId", "key");
CREATE INDEX "ApiIdempotencyKey_createdAt_idx" ON "public"."ApiIdempotencyKey"("createdAt");
CREATE INDEX "ApiGeneration_status_createdAt_idx" ON "public"."ApiGeneration"("status", "createdAt");
CREATE INDEX "ApiGeneration_clientSiteId_createdAt_idx" ON "public"."ApiGeneration"("clientSiteId", "createdAt");

ALTER TABLE "public"."ApiKey"
    ADD CONSTRAINT "ApiKey_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ApiIdempotencyKey"
    ADD CONSTRAINT "ApiIdempotencyKey_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ApiGeneration"
    ADD CONSTRAINT "ApiGeneration_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ApiGeneration_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "public"."ApiKey" ("id", "clientSiteId", "name", "prefix", "hash", "scopes")
SELECT gen_random_uuid()::text,
       "id",
       'Default',
       left("apiKey", 11),
       encode(sha256(convert_to(btrim("apiKey"), 'UTF8')), 'hex'),
       ARRAY['READ']::"public"."ApiKeyScope"[]
FROM "public"."ClientSite"
WHERE "apiKey" IS NOT NULL AND btrim("apiKey") <> '';

ALTER TABLE "public"."ClientSite" DROP COLUMN "apiKey";
