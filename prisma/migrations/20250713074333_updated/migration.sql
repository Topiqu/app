/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "readingTime" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "bio" TEXT;

-- DropEnum
DROP TYPE "UserRole";

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");
