-- CreateEnum
CREATE TYPE "BillingPlans" AS ENUM ('MONTHLY', 'ANNUAL', 'PERMANENT');

-- DropIndex
DROP INDEX "ClientSite_subdomain_name_plan_idx";

-- AlterTable
ALTER TABLE "ClientSite" ADD COLUMN     "billingPlan" "BillingPlans" NOT NULL DEFAULT 'MONTHLY';

-- CreateIndex
CREATE INDEX "ClientSite_subdomain_name_plan_billingPlan_enableAi_enableC_idx" ON "ClientSite"("subdomain", "name", "plan", "billingPlan", "enableAi", "enableCron", "enableSentiment");
