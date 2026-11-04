CREATE TABLE "AiAllowanceInvoice" (
    "id" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,
    "grantedMicros" INTEGER NOT NULL CHECK ("grantedMicros" >= 0),
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAllowanceInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiAllowanceInvoice_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "ClientSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AiAllowanceInvoice_clientSiteId_createdAt_idx" ON "AiAllowanceInvoice"("clientSiteId", "createdAt");
