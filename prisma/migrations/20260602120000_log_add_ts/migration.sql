-- AlterTable: add authoritative chain timestamp, backfill legacy rows from createdAt
ALTER TABLE "Log" ADD COLUMN "ts" TIMESTAMP(3);

UPDATE "Log" SET "ts" = "createdAt" WHERE "ts" IS NULL;

ALTER TABLE "Log" ALTER COLUMN "ts" SET NOT NULL;
