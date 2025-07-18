/*
  Warnings:

  - A unique constraint covering the columns `[slug,clientSiteId]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,clientSiteId]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clientSiteId` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clientSiteId` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'superadmin');

-- CreateEnum
CREATE TYPE "GenerationFrequency" AS ENUM ('NONE', 'DAILY', 'WEEKLY');

-- DropIndex
DROP INDEX "Tag_name_key";

-- DropIndex
DROP INDEX "Tag_slug_key";

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "clientSiteId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "clientSiteId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clientSiteId" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'admin';

-- CreateTable
CREATE TABLE "ClientSite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "customDomain" TEXT,
    "topic" TEXT NOT NULL,
    "focus" TEXT,
    "keywords" JSONB,
    "plan" TEXT NOT NULL,
    "tokenLimit" INTEGER NOT NULL,
    "tokenRemaining" INTEGER NOT NULL,
    "generationFrequency" "GenerationFrequency" NOT NULL DEFAULT 'NONE',
    "lastGeneratedAt" TIMESTAMP(3),

    CONSTRAINT "ClientSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientSite_subdomain_key" ON "ClientSite"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSite_customDomain_key" ON "ClientSite"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_clientSiteId_key" ON "Tag"("slug", "clientSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_clientSiteId_key" ON "Tag"("name", "clientSiteId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
