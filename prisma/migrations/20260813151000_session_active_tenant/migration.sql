ALTER TABLE "Session" ADD COLUMN "clientSiteId" TEXT;

UPDATE "Session" s
SET "clientSiteId" = u."clientSiteId"
FROM "User" u
WHERE u.id = s."userId";

CREATE INDEX "Session_clientSiteId_idx" ON "Session"("clientSiteId");
ALTER TABLE "Session" ADD CONSTRAINT "Session_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
