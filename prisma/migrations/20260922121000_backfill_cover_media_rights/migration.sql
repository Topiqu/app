-- Forward-only data backfill. It records only provenance already stored in Article.imageCredit;
-- a missing credit remains UNKNOWN and is deliberately not interpreted as permission.
INSERT INTO "public"."MediaAsset" (
    "id",
    "clientSiteId",
    "url",
    "origin",
    "sourceUrl",
    "author",
    "license",
    "licenseUrl",
    "attribution",
    "attributionRequired",
    "createdAt"
)
SELECT
    gen_random_uuid()::text,
    article."clientSiteId",
    article."imageUrl",
    CASE
        WHEN article."imageCredit"->>'kind' = 'ai' THEN 'TOPIQU_AI'::"public"."MediaOrigin"
        WHEN UPPER(COALESCE(article."imageCredit"->'credit'->>'license', '')) LIKE 'CC%' THEN 'CREATIVE_COMMONS'::"public"."MediaOrigin"
        WHEN article."imageCredit"->'credit'->>'source' IS NOT NULL THEN 'EXTERNAL'::"public"."MediaOrigin"
        ELSE 'UNKNOWN'::"public"."MediaOrigin"
    END,
    article."imageCredit"->'credit'->>'sourceUrl',
    article."imageCredit"->'credit'->>'author',
    article."imageCredit"->'credit'->>'license',
    article."imageCredit"->'credit'->>'licenseUrl',
    CONCAT_WS(
        ' · ',
        article."imageCredit"->'credit'->>'author',
        article."imageCredit"->'credit'->>'license',
        article."imageCredit"->'credit'->>'source'
    ),
    UPPER(COALESCE(article."imageCredit"->'credit'->>'license', '')) LIKE 'CC%',
    CURRENT_TIMESTAMP
FROM "public"."Article" article
WHERE article."imageUrl" IS NOT NULL
  AND article."imageUrl" <> ''
  AND article."coverMediaId" IS NULL;

UPDATE "public"."Article" article
SET "coverMediaId" = (
    SELECT media."id"
    FROM "public"."MediaAsset" media
    WHERE media."clientSiteId" = article."clientSiteId"
      AND media."url" = article."imageUrl"
    ORDER BY media."createdAt" DESC
    LIMIT 1
)
WHERE article."coverMediaId" IS NULL
  AND article."imageUrl" IS NOT NULL
  AND article."imageUrl" <> '';
