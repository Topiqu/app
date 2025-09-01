-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "allowEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Article_title_idx" ON "public"."Article"("title");

-- CreateIndex
CREATE INDEX "Article_excerpt_idx" ON "public"."Article"("excerpt");

-- CreateIndex
CREATE INDEX "Article_content_idx" ON "public"."Article"("content");
