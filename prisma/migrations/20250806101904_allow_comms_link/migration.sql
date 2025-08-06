-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "allowedComments" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "link" TEXT;
