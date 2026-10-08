CREATE TYPE "public"."WidgetKind" AS ENUM ('ANNOUNCEMENT', 'DIVIDER', 'CTA', 'PRICE', 'WEATHER', 'HTML');

CREATE TABLE "public"."SiteWidget" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "clientSiteId" TEXT NOT NULL,
    "kind" "public"."WidgetKind" NOT NULL,
    "slot" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "languages" "public"."Language"[],
    "config" JSONB NOT NULL,
    CONSTRAINT "SiteWidget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteWidget_clientSiteId_idx" ON "public"."SiteWidget"("clientSiteId");

ALTER TABLE "public"."SiteWidget"
    ADD CONSTRAINT "SiteWidget_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "public"."ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
