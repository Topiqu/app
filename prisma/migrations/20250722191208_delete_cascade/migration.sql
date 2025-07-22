-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_clientSiteId_fkey";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
