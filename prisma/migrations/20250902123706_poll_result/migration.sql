-- CreateTable
CREATE TABLE "public"."PollResult" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "articleId" TEXT NOT NULL,
    "userId" TEXT,
    "pollId" TEXT,
    "sessionId" TEXT,
    "response" TEXT NOT NULL,

    CONSTRAINT "PollResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollResult_articleId_response_idx" ON "public"."PollResult"("articleId", "response");

-- AddForeignKey
ALTER TABLE "public"."PollResult" ADD CONSTRAINT "PollResult_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
