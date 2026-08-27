ALTER TABLE "SearchConsoleConnection"
ADD COLUMN "autopilotEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autopilotLastRunAt" TIMESTAMP(3);
