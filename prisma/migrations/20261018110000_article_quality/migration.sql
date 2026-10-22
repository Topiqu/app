CREATE TYPE "ArticleQuality" AS ENUM ('STANDARD', 'HIGH', 'ULTRA');

ALTER TABLE "ClientSite"
ADD COLUMN "articleQuality" "ArticleQuality" NOT NULL DEFAULT 'STANDARD';
