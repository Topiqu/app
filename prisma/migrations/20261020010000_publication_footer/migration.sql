-- Nullable and additive: existing publications keep their current footer.
ALTER TABLE "public"."ClientSite" ADD COLUMN "footerSettings" JSONB;
