BEGIN;

CREATE TABLE "OnboardingRequest" (
    "id" TEXT NOT NULL,
    "identityHash" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "clientSiteId" TEXT,
    "userId" TEXT,
    "returnUrl" TEXT,
    "priceId" TEXT,
    "memberPriceId" TEXT,
    "trial" BOOLEAN NOT NULL DEFAULT false,
    "customerStartedAt" TIMESTAMP(3),
    "checkoutStartedAt" TIMESTAMP(3),
    "stripeCheckoutId" TEXT,
    "completedAt" TIMESTAMP(3),
    "leaseId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OnboardingRequest_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OnboardingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OnboardingRequest_account_check" CHECK (("clientSiteId" IS NULL) = ("userId" IS NULL)),
    CONSTRAINT "OnboardingRequest_hash_check" CHECK ("identityHash" ~ '^[a-f0-9]{64}$' AND "keyHash" ~ '^[a-f0-9]{64}$' AND "fingerprint" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "OnboardingRequest_identityHash_key" ON "OnboardingRequest"("identityHash");
CREATE UNIQUE INDEX "OnboardingRequest_keyHash_key" ON "OnboardingRequest"("keyHash");
CREATE UNIQUE INDEX "OnboardingRequest_clientSiteId_key" ON "OnboardingRequest"("clientSiteId");
CREATE UNIQUE INDEX "OnboardingRequest_userId_key" ON "OnboardingRequest"("userId");

COMMIT;
