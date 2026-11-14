-- Pictures proposed for a saved article, picked in the background.
CREATE TYPE "ArticleImagePickStatus" AS ENUM ('RUNNING', 'READY', 'FAILED');

CREATE TABLE "ArticleImagePick" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "articleId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ArticleImagePickStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "articleVersion" INTEGER NOT NULL,
    "content" TEXT,
    "imageUrl" TEXT,
    "coverMediaId" TEXT,
    "error" TEXT,
    CONSTRAINT "ArticleImagePick_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArticleImagePick_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ArticleImagePick_articleId_key" ON "ArticleImagePick"("articleId");
