-- AlterTable
ALTER TABLE "ClientSite" ADD COLUMN     "annualPayment" INTEGER DEFAULT 0,
ADD COLUMN     "monthlyPayment" INTEGER DEFAULT 0;

-- CreateIndex
CREATE INDEX "User_username_email_role_language_allowNotifs_idx" ON "User"("username", "email", "role", "language", "allowNotifs");
