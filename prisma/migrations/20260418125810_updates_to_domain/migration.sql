/*
  Warnings:

  - You are about to drop the column `subdomain` on the `ClientSite` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[domain]` on the table `ClientSite` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `domain` to the `ClientSite` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PublishMode" AS ENUM ('HitL', 'FullAuto');

-- CreateEnum
CREATE TYPE "ContentTaskStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVE', 'REJECT');

-- DropIndex
DROP INDEX "public"."ClientSite_subdomain_key";

-- DropIndex
DROP INDEX "public"."ClientSite_subdomain_name_plan_billingPlan_enableAi_enableC_idx";

-- -------------------------------------------------------------------------
-- BEZPEČNÁ MIGRACE DAT: subdomain -> domain
-- 1. Přidáme nový sloupec jako volitelný (aby databáze nekřičela kvůli NULL)
-- 2. Přelijeme do něj data
-- 3. Zamkneme ho jako NOT NULL
-- 4. Teprve teď můžeme starý sloupec smazat a přidat ostatní nové sloupce
-- -------------------------------------------------------------------------
ALTER TABLE "ClientSite" ADD COLUMN "domain" TEXT;
UPDATE "ClientSite" SET "domain" = "subdomain";
ALTER TABLE "ClientSite" ALTER COLUMN "domain" SET NOT NULL;

-- Nyní aplikujeme zbytek tvých původních změn na ClientSite tabulku
ALTER TABLE "ClientSite" DROP COLUMN "subdomain",
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;
-- -------------------------------------------------------------------------


-- CreateTable
CREATE TABLE "LinkedinCompany" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "linkedinOrgId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'personal',
    "mode" "PublishMode" NOT NULL DEFAULT 'HitL',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "cadence" TEXT NOT NULL DEFAULT 'daily',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,

    CONSTRAINT "LinkedinCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "tone" TEXT,
    "audience" TEXT,
    "doList" TEXT[],
    "dontList" TEXT[],
    "examples" TEXT[],

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTask" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "ContentTaskStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ContentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPost" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "taskId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "policyFlags" JSONB,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "DraftPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "draftId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedPost" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "draftId" TEXT NOT NULL,
    "linkedinPostId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMetric" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "publishedPostId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedinCompany_linkedinOrgId_key" ON "LinkedinCompany"("linkedinOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_companyId_key" ON "BrandProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedPost_draftId_key" ON "PublishedPost"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedPost_linkedinPostId_key" ON "PublishedPost"("linkedinPostId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSite_domain_key" ON "ClientSite"("domain");

-- CreateIndex
CREATE INDEX "ClientSite_domain_name_plan_billingPlan_enableAi_enableCron_idx" ON "ClientSite"("domain", "name", "plan", "billingPlan", "enableAi", "enableCron", "enableSentiment");

-- AddForeignKey
ALTER TABLE "LinkedinCompany" ADD CONSTRAINT "LinkedinCompany_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "LinkedinCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "LinkedinCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPost" ADD CONSTRAINT "DraftPost_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "DraftPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "DraftPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMetric" ADD CONSTRAINT "PostMetric_publishedPostId_fkey" FOREIGN KEY ("publishedPostId") REFERENCES "PublishedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;