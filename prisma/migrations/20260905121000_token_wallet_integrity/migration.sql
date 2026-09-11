ALTER TABLE "TokenWallet" ADD CONSTRAINT "TokenWallet_id_fkey" FOREIGN KEY ("id") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenCreditGrant" ADD CONSTRAINT "TokenCreditGrant_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "TokenWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenOperation" ADD CONSTRAINT "TokenOperation_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "TokenWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenLedgerEntry" ADD CONSTRAINT "TokenLedgerEntry_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "TokenWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenLedgerEntry" ADD CONSTRAINT "TokenLedgerEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "TokenOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenLedgerEntry" ADD CONSTRAINT "TokenLedgerEntry_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "TokenCreditGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenCreditGrant" ADD CONSTRAINT "TokenCreditGrant_nonexpiring_purchases" CHECK ("source" NOT IN ('PURCHASE', 'MIGRATION', 'REFUND') OR "expiresAt" IS NULL);
ALTER TABLE "TokenOperation" ADD CONSTRAINT "TokenOperation_status_valid" CHECK ("status" IN ('RESERVED', 'COMPLETED', 'RELEASED'));
