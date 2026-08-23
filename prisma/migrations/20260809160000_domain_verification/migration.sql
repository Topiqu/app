CREATE TYPE "DomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'DEGRADED', 'FAILED');

ALTER TABLE "ClientSite"
  ADD COLUMN "domainVerificationStatus" "DomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "domainVerificationToken" TEXT,
  ADD COLUMN "domainVerificationIssuedAt" TIMESTAMP(3),
  ADD COLUMN "domainVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "domainLastCheckedAt" TIMESTAMP(3),
  ADD COLUMN "domainRoutingVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "domainVerificationFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "domainVerificationDegradedAt" TIMESTAMP(3),
  ADD COLUMN "domainVerificationError" TEXT;

UPDATE "ClientSite"
SET
  "domainVerificationStatus" = CASE WHEN "domainVerified" THEN 'VERIFIED'::"DomainVerificationStatus" ELSE 'PENDING'::"DomainVerificationStatus" END,
  "domainVerifiedAt" = CASE WHEN "domainVerified" THEN COALESCE("updatedAt", "createdAt") ELSE NULL END,
  "domainRoutingVerified" = "domainVerified";

-- Repair legacy internal sites created through the superadmin flow, which used the false default.
UPDATE "ClientSite"
SET
  "domainVerified" = true,
  "domainVerificationStatus" = 'VERIFIED',
  "domainVerifiedAt" = COALESCE("updatedAt", "createdAt"),
  "domainRoutingVerified" = true
WHERE "domain" = 'topiqu.com' OR "domain" LIKE '%.topiqu.com';

-- Grandfather live custom domains without downtime, but enroll them in the stronger TXT flow.
-- They remain publicly routable until an administrator completes the new verification.
UPDATE "ClientSite"
SET
  "domainVerificationStatus" = 'PENDING',
  "domainVerificationToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  "domainVerificationIssuedAt" = now()
WHERE "domainVerified" = true
  AND "domain" <> 'topiqu.com'
  AND "domain" NOT LIKE '%.topiqu.com';
