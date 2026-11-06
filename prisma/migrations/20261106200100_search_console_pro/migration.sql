-- Search Console data and REFRESH suggestions move into PRO; the autopilot stays PREMIUM/CUSTOM.
INSERT INTO "ClientFeature" ("id", "createdAt", "updatedAt", "clientSiteId", "featureId", "activatedAt", "billingLockedUntil", "isActive")
SELECT gen_random_uuid()::text, now(), now(), cs."id", f."id", now(), now(), true
FROM "ClientSite" cs JOIN "Feature" f ON f."code" = 'SEARCH_CONSOLE'
WHERE cs."deletedAt" IS NULL AND cs."plan" = 'PRO'
ON CONFLICT ("clientSiteId", "featureId") DO UPDATE
SET "isActive" = true, "activatedAt" = now(), "deactivatedAt" = NULL, "updatedAt" = now();
