ALTER TABLE "public"."KeywordCluster" ADD COLUMN "opportunity" JSONB;
ALTER TABLE "public"."ClientSite" ADD COLUMN "keywordPlanAttemptedAt" TIMESTAMP(3);
