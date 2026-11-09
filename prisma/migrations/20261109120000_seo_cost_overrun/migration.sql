ALTER TABLE "ClientSite"
    ADD COLUMN "seoBudgetDebtMicros" INTEGER NOT NULL DEFAULT 0 CHECK ("seoBudgetDebtMicros" >= 0);
