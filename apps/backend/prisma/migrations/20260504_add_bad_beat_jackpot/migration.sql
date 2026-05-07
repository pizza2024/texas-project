-- Migration: add_bad_beat_jackpot
-- Created: 2026-05-04

-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add Bad Beat Jackpot fields to Room
ALTER TABLE "rooms" ADD COLUMN "badBeatJackpotEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "rooms" ADD COLUMN "currentJackpotAmount" BIGINT NOT NULL DEFAULT 0;

-- Create BadBeatJackpot table
CREATE TABLE "bad_beat_jackpots" (
  "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
  "handId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "jackpotAmount" BIGINT NOT NULL,
  "loserId" TEXT NOT NULL,
  "loserHand" TEXT NOT NULL,
  "winnerId" TEXT NOT NULL,
  "winnerHand" TEXT NOT NULL,
  "netLoss" BIGINT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX "bad_beat_jackpots_handId_idx" ON "bad_beat_jackpots"("handId");
CREATE INDEX "bad_beat_jackpots_tableId_idx" ON "bad_beat_jackpots"("tableId");
CREATE INDEX "bad_beat_jackpots_roomId_idx" ON "bad_beat_jackpots"("roomId");

-- Create BadBeatPayout table
CREATE TABLE "bad_beat_payouts" (
  "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
  "jackpotId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("jackpotId") REFERENCES "bad_beat_jackpots"("id") ON DELETE CASCADE
);

CREATE INDEX "bad_beat_payouts_userId_idx" ON "bad_beat_payouts"("userId");
CREATE INDEX "bad_beat_payouts_jackpotId_idx" ON "bad_beat_payouts"("jackpotId");
