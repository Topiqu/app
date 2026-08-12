ALTER TYPE "FeatureCodes" ADD VALUE IF NOT EXISTS 'SEARCH_CONSOLE';
CREATE TYPE "SearchConsoleConnectionStatus" AS ENUM ('CONNECTED', 'ERROR', 'REVOKED');

CREATE TABLE "SearchConsoleConnection" (
  "id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3), "deletedAt" TIMESTAMP(3), "clientSiteId" TEXT NOT NULL,
  "googleSubjectId" TEXT NOT NULL, "googleEmail" TEXT, "propertyUrl" TEXT,
  "permissionLevel" TEXT, "encryptedRefreshToken" TEXT NOT NULL, "grantedScopes" TEXT[],
  "status" "SearchConsoleConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "lastSyncAt" TIMESTAMP(3), "lastErrorAt" TIMESTAMP(3), "lastError" TEXT,
  CONSTRAINT "SearchConsoleConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SearchConsoleConnection_clientSiteId_key" ON "SearchConsoleConnection"("clientSiteId");
ALTER TABLE "SearchConsoleConnection" ADD CONSTRAINT "SearchConsoleConnection_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SearchConsoleMetric" (
  "id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3), "deletedAt" TIMESTAMP(3), "clientSiteId" TEXT NOT NULL,
  "propertyUrl" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL, "page" TEXT NOT NULL,
  "query" TEXT NOT NULL DEFAULT '', "country" TEXT NOT NULL DEFAULT '', "device" TEXT NOT NULL DEFAULT '',
  "clicks" DOUBLE PRECISION NOT NULL DEFAULT 0, "impressions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0, "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "SearchConsoleMetric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SearchConsoleMetric_tenant_row_key" ON "SearchConsoleMetric"("clientSiteId", "date", "page", "query", "country", "device");
CREATE INDEX "SearchConsoleMetric_clientSiteId_date_idx" ON "SearchConsoleMetric"("clientSiteId", "date");
CREATE INDEX "SearchConsoleMetric_clientSiteId_page_date_idx" ON "SearchConsoleMetric"("clientSiteId", "page", "date");
ALTER TABLE "SearchConsoleMetric" ADD CONSTRAINT "SearchConsoleMetric_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Feature" ("id", "createdAt", "updatedAt", "code", "name", "priceMonthly")
VALUES (gen_random_uuid()::text, now(), now(), 'SEARCH_CONSOLE', 'Search Console Intelligence', 29)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "ClientFeature" ("id", "createdAt", "updatedAt", "clientSiteId", "featureId", "activatedAt", "billingLockedUntil", "isActive")
SELECT gen_random_uuid()::text, now(), now(), cs."id", f."id", now(), now(), true
FROM "ClientSite" cs JOIN "Feature" f ON f."code" = 'SEARCH_CONSOLE'
WHERE cs."deletedAt" IS NULL AND cs."plan" = 'PREMIUM'
ON CONFLICT ("clientSiteId", "featureId") DO NOTHING;
