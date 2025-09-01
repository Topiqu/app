-- CreateEnum
CREATE TYPE "public"."SharePlatform" AS ENUM ('TWITTER', 'FACEBOOK', 'LINKEDIN', 'EMAIL', 'OTHER');

-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "shared" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."ArticleShare" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "articleId" TEXT NOT NULL,
    "platform" "public"."SharePlatform" NOT NULL,

    CONSTRAINT "ArticleShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleShare_articleId_platform_key" ON "public"."ArticleShare"("articleId", "platform");

-- AddForeignKey
ALTER TABLE "public"."ArticleShare" ADD CONSTRAINT "ArticleShare_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
