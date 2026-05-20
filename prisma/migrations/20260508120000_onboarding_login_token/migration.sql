-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboardingLoginToken" TEXT,
ADD COLUMN "onboardingLoginTokenExpiresAt" TIMESTAMP(3);
