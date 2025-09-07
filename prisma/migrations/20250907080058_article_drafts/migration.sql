-- CreateTable
CREATE TABLE "public"."ArticleDraft" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,

    CONSTRAINT "ArticleDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleDraft_userId_updatedAt_idx" ON "public"."ArticleDraft"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "public"."ArticleDraft" ADD CONSTRAINT "ArticleDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleDraft" ADD CONSTRAINT "ArticleDraft_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
