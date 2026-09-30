CREATE TYPE "ShopifyConnectionStatus" AS ENUM ('CONNECTED', 'REAUTH_REQUIRED', 'REVOKED');
CREATE TYPE "ShopifyPublicationStatus" AS ENUM ('QUEUED', 'PUBLISHING', 'SYNCED', 'FAILED', 'UNCERTAIN');

CREATE TABLE "ShopifyConnection" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "storefrontUrl" TEXT NOT NULL,
    "blogId" TEXT,
    "blogTitle" TEXT,
    "author" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "refreshLease" TEXT,
    "refreshLeaseUntil" TIMESTAMP(3),
    "grantedScopes" TEXT[] NOT NULL,
    "status" "ShopifyConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    CONSTRAINT "ShopifyConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopifyPublication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "shopifyArticleId" TEXT,
    "blogId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "url" TEXT,
    "status" "ShopifyPublicationStatus" NOT NULL DEFAULT 'QUEUED',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createStartedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    CONSTRAINT "ShopifyPublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopifyOAuthAttempt" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopifyOAuthAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopifyConnection_clientSiteId_key" ON "ShopifyConnection"("clientSiteId");
CREATE UNIQUE INDEX "ShopifyConnection_shop_key" ON "ShopifyConnection"("shop");
CREATE UNIQUE INDEX "ShopifyPublication_connectionId_articleId_key" ON "ShopifyPublication"("connectionId", "articleId");
CREATE INDEX "ShopifyPublication_status_nextAttemptAt_idx" ON "ShopifyPublication"("status", "nextAttemptAt");
CREATE UNIQUE INDEX "ShopifyOAuthAttempt_tokenHash_key" ON "ShopifyOAuthAttempt"("tokenHash");
CREATE INDEX "ShopifyOAuthAttempt_expiresAt_idx" ON "ShopifyOAuthAttempt"("expiresAt");

ALTER TABLE "ShopifyConnection" ADD CONSTRAINT "ShopifyConnection_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopifyPublication" ADD CONSTRAINT "ShopifyPublication_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopifyPublication" ADD CONSTRAINT "ShopifyPublication_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopifyPublication" ADD CONSTRAINT "ShopifyPublication_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ShopifyConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
