-- Why the autopilot held a finished article back as a draft.
ALTER TABLE "Article" ADD COLUMN "releaseHold" JSONB;
