/*
  Warnings:

  - You are about to drop the column `clientSiteId` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `clientSiteId` on the `Tag` table. All the data in the column will be lost.
  - You are about to drop the column `clientSiteId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ClientSite` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_clientSiteId_fkey";

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_clientSiteId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_clientSiteId_fkey";

-- DropIndex
DROP INDEX "Tag_name_clientSiteId_key";

-- DropIndex
DROP INDEX "Tag_slug_clientSiteId_key";

-- AlterTable
ALTER TABLE "Article" DROP COLUMN "clientSiteId";

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "clientSiteId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "clientSiteId",
DROP COLUMN "role";

-- DropTable
DROP TABLE "ClientSite";

-- DropEnum
DROP TYPE "GenerationFrequency";

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
