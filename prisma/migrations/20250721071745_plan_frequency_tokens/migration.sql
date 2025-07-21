-- CreateEnum
CREATE TYPE "ClientPlan" AS ENUM ('BASIC', 'PRO', 'PREMIUM', 'CUSTOM');

-- AlterTable
ALTER TABLE "ClientSite" ADD COLUMN     "generationFrequency" "GenerationFrequency" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "plan" "ClientPlan" NOT NULL DEFAULT 'BASIC',
ADD COLUMN     "tokenLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tokenRemaining" INTEGER NOT NULL DEFAULT 0;
