-- CreateEnum
CREATE TYPE "SentimentStatus" AS ENUM ('PENDING', 'SKIPPED', 'PROCESSED', 'ERROR');

-- AlterEnum
ALTER TYPE "ArticleStatus" ADD VALUE 'archived';

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "sentiment" JSONB,
ADD COLUMN     "sentimentStatus" "SentimentStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Comment_sentimentStatus_idx" ON "Comment"("sentimentStatus");
