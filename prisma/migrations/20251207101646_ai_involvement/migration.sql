-- CreateEnum
CREATE TYPE "AIInvolvement" AS ENUM ('NONE', 'ASSIST', 'FULL');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "aiInvolvement" "AIInvolvement" NOT NULL DEFAULT 'NONE';
