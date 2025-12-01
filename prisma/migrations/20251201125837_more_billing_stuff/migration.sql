-- AlterTable
ALTER TABLE "ClientSite" ADD COLUMN     "firstPaidAt" TIMESTAMP(3),
ADD COLUMN     "lastInvoicedAt" TIMESTAMP(3),
ADD COLUMN     "nextBillingAt" TIMESTAMP(3);
