CREATE TABLE "KeywordRejection" (
    "id" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordRejection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KeywordRejection_clientSiteId_keyword_key" ON "KeywordRejection"("clientSiteId", "keyword");

ALTER TABLE "KeywordRejection" ADD CONSTRAINT "KeywordRejection_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
