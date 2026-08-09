-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "answer" TEXT,
ADD COLUMN     "faq" JSONB,
ADD COLUMN     "keyTakeaways" TEXT[];

-- AlterTable
ALTER TABLE "ArticleTranslation" ADD COLUMN     "answer" TEXT,
ADD COLUMN     "faq" JSONB,
ADD COLUMN     "keyTakeaways" TEXT[];

-- Pre-existing drift, not part of this change: the column defaulted to true while the schema has
-- declared false since the domain-verification work.
ALTER TABLE "ClientSite" ALTER COLUMN "domainVerified" SET DEFAULT false;
