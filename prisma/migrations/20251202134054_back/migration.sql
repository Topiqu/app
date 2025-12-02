/*
  Warnings:

  - You are about to alter the column `annualPayment` on the `ClientSite` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `monthlyPayment` on the `ClientSite` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `priceMonthly` on the `Feature` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `priceAnnual` on the `Feature` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "ClientSite" ALTER COLUMN "annualPayment" SET DEFAULT 0,
ALTER COLUMN "annualPayment" SET DATA TYPE INTEGER,
ALTER COLUMN "monthlyPayment" SET DEFAULT 0,
ALTER COLUMN "monthlyPayment" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Feature" ALTER COLUMN "priceMonthly" SET DATA TYPE INTEGER,
ALTER COLUMN "priceAnnual" SET DATA TYPE INTEGER;
