-- AddDepositAddressLabels
-- Add label and isDefault fields to DepositAddress, replace single-column @unique with composite unique([userId, address])

-- Step 1: Add new columns (nullable/default immediately)
ALTER TABLE "deposit_addresses" ADD COLUMN "label" VARCHAR(255);
ALTER TABLE "deposit_addresses" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: For existing records, mark them as default (they are each user's only address)
UPDATE "deposit_addresses" SET "isDefault" = true;

-- Step 3: Drop the existing unique constraint on userId
-- PostgreSQL auto-names it as "deposit_addresses_userId_key"
ALTER TABLE "deposit_addresses" DROP CONSTRAINT IF EXISTS "deposit_addresses_userId_key";

-- Step 4: Drop the existing unique constraint on address
-- PostgreSQL auto-names it as "deposit_addresses_address_key"
ALTER TABLE "deposit_addresses" DROP CONSTRAINT IF EXISTS "deposit_addresses_address_key";

-- Step 5: Add composite unique constraint (userId, address)
ALTER TABLE "deposit_addresses" ADD CONSTRAINT "deposit_addresses_userId_address_unique" UNIQUE ("userId", "address");
