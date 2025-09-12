-- CreateEnum
CREATE TYPE "public"."Language" AS ENUM ('cs', 'en');

-- AlterTable
ALTER TABLE "public"."ClientSite" ADD COLUMN     "language" "public"."Language" NOT NULL DEFAULT 'en';
