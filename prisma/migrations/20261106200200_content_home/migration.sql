-- The customer's own site can be the indexable home; the blog copy then serves noindex.
CREATE TYPE "ContentHome" AS ENUM ('TOPIQU', 'EXTERNAL');

ALTER TABLE "ClientSite" ADD COLUMN "contentHome" "ContentHome" NOT NULL DEFAULT 'TOPIQU';
