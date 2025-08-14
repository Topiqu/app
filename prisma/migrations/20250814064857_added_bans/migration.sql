-- CreateTable
CREATE TABLE "UserBan" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "reason" TEXT,
    "bannedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserBan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
