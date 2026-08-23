-- Body images carry their caption and credit inside `content`; the cover is a bare `imageUrl`,
-- so a generated hero shipped with no AI disclosure and a licensed one with no attribution.
-- Holds `CoverCredit`: { kind: 'photo' | 'illustration' | 'ai', credit?: { author, license, source, … } }.
ALTER TABLE "Article" ADD COLUMN "imageCredit" JSONB;
