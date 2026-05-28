-- Normalize polls: introduce `Poll` + `PollOption` and tie votes to them via FKs.
-- Existing votes are intentionally discarded (text-based `response` cannot be safely
-- remapped to option ids without parsing article HTML) — confirmed acceptable.

-- 1. Wipe legacy votes so the new NOT NULL FK columns can be added safely.
DELETE FROM "PollResult";

-- 2. Drop the legacy denormalized vote shape.
DROP INDEX IF EXISTS "PollResult_articleId_response_idx";
ALTER TABLE "PollResult" DROP COLUMN "response";

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "articleId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- 3. Add the normalized vote columns (table is empty, so NOT NULL is safe).
ALTER TABLE "PollResult" ADD COLUMN "optionId" TEXT NOT NULL;
ALTER TABLE "PollResult" ALTER COLUMN "pollId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Poll_articleId_idx" ON "Poll"("articleId");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE INDEX "PollResult_pollId_idx" ON "PollResult"("pollId");

-- CreateIndex
CREATE INDEX "PollResult_optionId_idx" ON "PollResult"("optionId");

-- CreateIndex
CREATE INDEX "PollResult_articleId_idx" ON "PollResult"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "PollResult_pollId_userId_key" ON "PollResult"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PollResult_pollId_sessionId_key" ON "PollResult"("pollId", "sessionId");

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollResult" ADD CONSTRAINT "PollResult_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollResult" ADD CONSTRAINT "PollResult_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
