-- Meta cookies, IP and user agent from a consented sign-up, kept to attribute the first payment.
ALTER TABLE "public"."User" ADD COLUMN "metaSignals" JSONB;
