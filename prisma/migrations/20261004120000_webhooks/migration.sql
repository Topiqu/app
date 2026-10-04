CREATE TYPE "public"."WebhookEvent" AS ENUM ('ARTICLE_PUBLISHED', 'ARTICLE_UPDATED', 'ARTICLE_UNPUBLISHED', 'ARTICLE_DELETED');
CREATE TYPE "public"."WebhookDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "public"."Webhook" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" "public"."WebhookEvent"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failureStreak" INTEGER NOT NULL DEFAULT 0,
    "disabledAt" TIMESTAMP(3),
    "lastDeliveryAt" TIMESTAMP(3),
    "lastStatusCode" INTEGER,
    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."WebhookDelivery" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "webhookId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "event" "public"."WebhookEvent" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "public"."WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStatusCode" INTEGER,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Webhook_clientSiteId_idx" ON "public"."Webhook"("clientSiteId");
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "public"."WebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "WebhookDelivery_webhookId_createdAt_idx" ON "public"."WebhookDelivery"("webhookId", "createdAt");

ALTER TABLE "public"."Webhook"
    ADD CONSTRAINT "Webhook_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."WebhookDelivery"
    ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "public"."Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "WebhookDelivery_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
