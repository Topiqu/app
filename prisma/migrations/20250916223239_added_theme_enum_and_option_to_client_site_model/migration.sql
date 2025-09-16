-- CreateEnum
CREATE TYPE "public"."Theme" AS ENUM ('blue', 'green', 'red', 'purple', 'orange', 'teal', 'yellow', 'pink', 'indigo', 'gray', 'lime', 'sky', 'amber', 'cyan', 'violet');

-- AlterTable
ALTER TABLE "public"."ClientSite" ADD COLUMN     "theme" "public"."Theme" NOT NULL DEFAULT 'blue';
