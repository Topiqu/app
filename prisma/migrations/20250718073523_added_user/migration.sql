-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'superadmin');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'admin';
