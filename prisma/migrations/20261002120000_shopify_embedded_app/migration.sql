CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'SHOPIFY');
ALTER TABLE "ClientSite" ADD COLUMN "billingProvider" "BillingProvider" NOT NULL DEFAULT 'STRIPE';

ALTER TABLE "ShopifyConnection" ADD COLUMN "shopGid" TEXT,
  ADD COLUMN "planHandle" TEXT,
  ADD COLUMN "planCheckedAt" TIMESTAMP(3);

CREATE TABLE "ShopifyInstallation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shop" TEXT NOT NULL,
    "shopGid" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "storefrontUrl" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "grantedScopes" TEXT[] NOT NULL,
    CONSTRAINT "ShopifyInstallation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShopifyInstallation_shop_key" ON "ShopifyInstallation"("shop");

DROP TABLE "ShopifyOAuthAttempt";
