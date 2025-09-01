-- CreateEnum
CREATE TYPE "public"."SocialPlatform" AS ENUM ('FACEBOOK', 'TWITTER', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'OTHER');

-- CreateTable
CREATE TABLE "public"."Social" (
    "id" TEXT NOT NULL,
    "platform" "public"."SocialPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,

    CONSTRAINT "Social_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Social" ADD CONSTRAINT "Social_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
