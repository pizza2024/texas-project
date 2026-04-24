-- AddFirstDepositBonus
ALTER TABLE "users" ADD COLUMN "hasReceivedFirstDepositBonus" BOOLEAN NOT NULL DEFAULT false;