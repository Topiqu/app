ALTER TYPE "AiVisibilityProvider" ADD VALUE IF NOT EXISTS 'ANTHROPIC';
ALTER TYPE "AiVisibilityProvider" ADD VALUE IF NOT EXISTS 'XAI';
ALTER TYPE "AiVisibilityProvider" ADD VALUE IF NOT EXISTS 'GOOGLE';
ALTER TYPE "AiVisibilityProvider" ADD VALUE IF NOT EXISTS 'META';
ALTER TYPE "AiVisibilityProvider" ADD VALUE IF NOT EXISTS 'MISTRAL';

CREATE INDEX "AiVisibilityRun_promptId_provider_executedAt_idx"
ON "AiVisibilityRun"("promptId", "provider", "executedAt");
