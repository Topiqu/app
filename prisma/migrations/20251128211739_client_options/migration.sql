-- AlterTable
ALTER TABLE "ClientSite" ADD COLUMN     "enableAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableCron" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableSentiment" BOOLEAN NOT NULL DEFAULT false;
