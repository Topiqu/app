-- Preserve the published translation while a replacement runs in the background.
ALTER TABLE "ArticleTranslation" ADD COLUMN "translationStartedAt" TIMESTAMP(3);
