ALTER TABLE "ClientSite" ADD COLUMN "discloseAiContent" BOOLEAN NOT NULL DEFAULT false;

-- Older generated body images baked the disclosure into their caption as plain text. Wrap only
-- the exact generated caption prefix so the new tenant toggle also controls historical articles.
UPDATE "Article"
SET "content" = replace(
  replace(
    "content",
    '<small style="color: gray;">Illustrative image (AI): ',
    '<small style="color: gray;"><span data-ai-disclosure>Illustrative image (AI): </span>'
  ),
  '<small style="color: gray;">Ilustrační obrázek (AI): ',
  '<small style="color: gray;"><span data-ai-disclosure>Ilustrační obrázek (AI): </span>'
)
WHERE "content" LIKE '%<small style="color: gray;">Illustrative image (AI): %'
   OR "content" LIKE '%<small style="color: gray;">Ilustrační obrázek (AI): %';
