-- AlterTable
ALTER TABLE "public"."ClientSite" ADD COLUMN     "audience" TEXT,
ADD COLUMN     "lastGeneratedAt" TIMESTAMP(3);
