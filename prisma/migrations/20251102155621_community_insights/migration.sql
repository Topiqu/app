-- DropIndex
DROP INDEX "public"."Article_excerpt_idx";

-- DropIndex
DROP INDEX "public"."Article_title_idx";

-- AlterTable
ALTER TABLE "ClientSite" ADD COLUMN     "communityInsight" JSONB,
ADD COLUMN     "insightUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Article_title_excerpt_clientSiteId_idx" ON "Article"("title", "excerpt", "clientSiteId");

-- CreateIndex
CREATE INDEX "ClientSite_subdomain_name_plan_idx" ON "ClientSite"("subdomain", "name", "plan");
