CREATE TABLE "ArticleView" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "articleId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "viewedOn" DATE NOT NULL,

    CONSTRAINT "ArticleView_pkey" PRIMARY KEY ("id")
);

-- One row per visitor per article per day. No column in the tuple is nullable, so Postgres
-- actually enforces it — the ON CONFLICT in the view endpoint depends on that.
CREATE UNIQUE INDEX "ArticleView_articleId_sessionId_viewedOn_key"
    ON "ArticleView"("articleId", "sessionId", "viewedOn");

-- Serves the dashboard's daily series: filter by tenant, bucket by day.
CREATE INDEX "ArticleView_clientSiteId_viewedOn_idx" ON "ArticleView"("clientSiteId", "viewedOn");

ALTER TABLE "ArticleView" ADD CONSTRAINT "ArticleView_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleView" ADD CONSTRAINT "ArticleView_clientSiteId_fkey"
    FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleView" ADD CONSTRAINT "ArticleView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
