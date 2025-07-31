-- CreateTable
CREATE TABLE "Emoji" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "shortcode" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,

    CONSTRAINT "Emoji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmojiReaction" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "emojiId" TEXT NOT NULL,

    CONSTRAINT "EmojiReaction_pkey" PRIMARY KEY ("userId","commentId","emojiId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Emoji_shortcode_key" ON "Emoji"("shortcode");

-- AddForeignKey
ALTER TABLE "Emoji" ADD CONSTRAINT "Emoji_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmojiReaction" ADD CONSTRAINT "EmojiReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmojiReaction" ADD CONSTRAINT "EmojiReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmojiReaction" ADD CONSTRAINT "EmojiReaction_emojiId_fkey" FOREIGN KEY ("emojiId") REFERENCES "Emoji"("id") ON DELETE CASCADE ON UPDATE CASCADE;
