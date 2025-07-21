-- AlterTable
ALTER TABLE "ClientSite" ALTER COLUMN "tokenLimit" DROP NOT NULL,
ALTER COLUMN "tokenRemaining" DROP NOT NULL;
