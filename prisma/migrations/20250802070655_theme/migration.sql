-- CreateEnum
CREATE TYPE "ThemeOption" AS ENUM ('light', 'dark');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "theme" "ThemeOption" NOT NULL DEFAULT 'light';
