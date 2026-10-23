-- Drain old LinkedIn publishing workers before rollout: they release uncertain
-- remote outcomes to FAILED and can retry an already accepted publication.
-- PUBLISHING remains a durable lock until its outcome is reconciled; never reset
-- historical PUBLISHING rows to a publishable state merely because they are old.
ALTER TABLE "DraftPost"
    ADD COLUMN "publicationAttemptedAt" TIMESTAMP(3),
    ADD COLUMN "publicationUrn" TEXT,
    ADD COLUMN "publicationError" TEXT;
