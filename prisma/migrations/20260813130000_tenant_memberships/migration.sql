CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "TenantScope" AS ENUM ('ARTICLE_WRITE', 'ARTICLE_WRITE_OTHERS', 'ARTICLE_PUBLISH', 'MEMBER_CONTROL', 'TENANT_SETTINGS', 'INTEGRATION_CONTROL', 'BILLING_CHANGE', 'API_KEY_CONTROL', 'AI_USE', 'ANALYTICS_READ');

CREATE TABLE "TenantMembership" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "clientSiteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
  "scopes" "TenantScope"[],
  CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantInvitation" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "clientSiteId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "scopes" "TenantScope"[],
  "invitedById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantMembership_clientSiteId_userId_key" ON "TenantMembership"("clientSiteId", "userId");
CREATE INDEX "TenantMembership_userId_idx" ON "TenantMembership"("userId");
CREATE UNIQUE INDEX "TenantMembership_one_owner" ON "TenantMembership"("clientSiteId") WHERE "role" = 'OWNER' AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "TenantInvitation_tokenHash_key" ON "TenantInvitation"("tokenHash");
CREATE INDEX "TenantInvitation_clientSiteId_email_idx" ON "TenantInvitation"("clientSiteId", "email");
CREATE INDEX "TenantInvitation_expiresAt_idx" ON "TenantInvitation"("expiresAt");

ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH ranked AS (
  SELECT "id", "clientSiteId", ROW_NUMBER() OVER (PARTITION BY "clientSiteId" ORDER BY "createdAt", "id") AS rn
  FROM "User" WHERE "role" = 'admin' AND "clientSiteId" IS NOT NULL AND "deletedAt" IS NULL
)
INSERT INTO "TenantMembership" ("id", "clientSiteId", "userId", "role", "scopes")
SELECT gen_random_uuid()::text, "clientSiteId", "id", CASE WHEN rn = 1 THEN 'OWNER'::"TenantRole" ELSE 'MEMBER'::"TenantRole" END,
  ARRAY['ARTICLE_WRITE','ARTICLE_WRITE_OTHERS','ARTICLE_PUBLISH','MEMBER_CONTROL','TENANT_SETTINGS','INTEGRATION_CONTROL','BILLING_CHANGE','API_KEY_CONTROL','AI_USE','ANALYTICS_READ']::"TenantScope"[]
FROM ranked;
