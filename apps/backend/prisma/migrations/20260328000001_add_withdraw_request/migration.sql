-- Migration: Add WithdrawRequest model
-- Created: 2026-03-28

-- Create withdraw_requests table
CREATE TABLE "withdraw_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountChips" DOUBLE PRECISION NOT NULL,
    "amountUsdt" DOUBLE PRECISION NOT NULL,
    "toAddress" TEXT NOT NULL,
    "fromAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "withdraw_requests_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient querying
CREATE INDEX "withdraw_requests_userId_status_idx" ON "withdraw_requests"("userId", "status");
CREATE INDEX "withdraw_requests_status_createdAt_idx" ON "withdraw_requests"("status", "createdAt");

-- Add foreign key constraint
ALTER TABLE "withdraw_requests"
    ADD CONSTRAINT "withdraw_requests_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Add check constraint for status values
ALTER TABLE "withdraw_requests"
    ADD CONSTRAINT "withdraw_requests_status_check"
    CHECK ("status" IN ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED'));
