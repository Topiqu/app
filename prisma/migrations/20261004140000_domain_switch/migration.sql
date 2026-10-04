ALTER TABLE "public"."ClientSite" ADD COLUMN "pendingDomain" TEXT,
    ADD COLUMN "pendingDomainToken" TEXT,
    ADD COLUMN "pendingDomainRequestedAt" TIMESTAMP(3);

CREATE TABLE "public"."DomainRedirect" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "host" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    CONSTRAINT "DomainRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DomainRedirect_host_key" ON "public"."DomainRedirect"("host");
CREATE INDEX "DomainRedirect_clientSiteId_idx" ON "public"."DomainRedirect"("clientSiteId");

ALTER TABLE "public"."DomainRedirect"
    ADD CONSTRAINT "DomainRedirect_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
