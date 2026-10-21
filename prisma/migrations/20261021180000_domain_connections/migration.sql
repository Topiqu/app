CREATE TYPE "DomainConnectionState" AS ENUM ('OWNERSHIP', 'DNS_UNAVAILABLE', 'CERTIFICATE', 'ROUTING', 'READY', 'DISCONNECTING', 'DISCONNECTED');
CREATE TYPE "DomainCertificateMode" AS ENUM ('AUTO', 'CUSTOM');
CREATE TABLE "DomainConnection" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "host" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "state" "DomainConnectionState" NOT NULL DEFAULT 'OWNERSHIP',
    "cloudflareId" TEXT,
    "cloudflareManaged" BOOLEAN NOT NULL DEFAULT false,
    "dokployId" TEXT,
    "dokployManaged" BOOLEAN NOT NULL DEFAULT false,
    "certificateId" TEXT,
    "certificateExpiresAt" TIMESTAMP(3),
    "certificateWarnedAt" TIMESTAMP(3),
    "certificateFingerprint" TEXT,
    "certificateMode" "DomainCertificateMode" NOT NULL DEFAULT 'AUTO',
    "encryptedCertificate" TEXT,
    "validationRecords" JSONB,
    "errorCode" TEXT,
    "checkedAt" TIMESTAMP(3),
    "ownershipLostAt" TIMESTAMP(3),
    "leaseId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "cleanupRequestedAt" TIMESTAMP(3),
    "probeSecret" TEXT NOT NULL,
    CONSTRAINT "DomainConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DomainConnection_host_key" ON "DomainConnection"("host");
CREATE INDEX "DomainConnection_state_checkedAt_idx" ON "DomainConnection"("state", "checkedAt");
CREATE INDEX "DomainConnection_clientSiteId_idx" ON "DomainConnection"("clientSiteId");
ALTER TABLE "DomainConnection" ADD CONSTRAINT "DomainConnection_clientSiteId_fkey"
    FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
