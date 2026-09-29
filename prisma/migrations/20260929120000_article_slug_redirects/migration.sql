CREATE TABLE "ArticleSlugRedirect" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleSlugRedirect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArticleSlugRedirect_slug_clientSiteId_key" ON "ArticleSlugRedirect"("slug", "clientSiteId");
CREATE INDEX "ArticleSlugRedirect_articleId_idx" ON "ArticleSlugRedirect"("articleId");
ALTER TABLE "ArticleSlugRedirect" ADD CONSTRAINT "ArticleSlugRedirect_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleSlugRedirect" ADD CONSTRAINT "ArticleSlugRedirect_clientSiteId_fkey"
    FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
