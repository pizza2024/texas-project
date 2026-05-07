/**
 * Bad Beat Jackpot Service
 *
 * Handles jackpot accumulation, detection, and distribution.
 *
 * Accumulation: Each showdown adds min(pot * 0.01, 100) + 10 cents to the jackpot
 * Distribution: On bad beat trigger, split as LOSER 50% / WINNER 25% / TABLE_PLAYERS 25%
 * Reset: After trigger, jackpot resets to tier-based initial amount
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  isBadBeat,
  type BadBeatEligibility,
  type ShowdownResult,
} from './badbeat-detector';

/** Jackpot reset amounts by room tier (in cents) */
export const JACKPOT_RESET_AMOUNTS: Record<string, number> = {
  MICRO: 50000, // $500
  LOW: 100000, // $1,000
  MEDIUM: 250000, // $2,500
  HIGH: 500000, // $5,000
  PREMIUM: 1000000, // $10,000
};

/** Default reset amount if tier not found */
const DEFAULT_RESET_AMOUNT = 100000; // $1,000

/** Bad beat payout percentages */
const PAYOUT_LOSER_PERCENT = 50;
const PAYOUT_WINNER_PERCENT = 25;
const PAYOUT_TABLE_PERCENT = 25;

/** Jackpot accumulation: 1% of pot (max 100 cents) + 10 cents per hand */
const JACKPOT_RAKE_PERCENT = 0.01;
const JACKPOT_RAKE_MAX_CENTS = 100; // $1
const JACKPOT_FEE_CENTS = 10; // $0.10

@Injectable()
export class BadBeatJackpotService {
  private readonly logger = new Logger(BadBeatJackpotService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculate jackpot accumulation amount for a given pot.
   * Returns amount in cents.
   */
  calculateAccumulation(potChips: number): number {
    // pot is in chips, convert to cents
    const potCents = potChips;
    const rakeAmount = Math.min(
      Math.floor(potCents * JACKPOT_RAKE_PERCENT),
      JACKPOT_RAKE_MAX_CENTS,
    );
    return rakeAmount + JACKPOT_FEE_CENTS;
  }

  /**
   * Accumulate jackpot for a room after a showdown.
   * Adds to the room's currentJackpotAmount.
   */
  async accumulateJackpot(roomId: string, amountCents: number): Promise<void> {
    await this.prisma.room.update({
      where: { id: roomId },
      data: {
        currentJackpotAmount: {
          increment: BigInt(amountCents),
        },
      },
    });
  }

  /**
   * Get current jackpot stats for a room.
   */
  async getJackpotStats(roomId: string): Promise<{
    enabled: boolean;
    currentAmount: bigint;
    lastHit?: string;
  }> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        badBeatJackpotEnabled: true,
        currentJackpotAmount: true,
      },
    });

    if (!room) {
      return { enabled: false, currentAmount: BigInt(0) };
    }

    // Find last hit time
    const lastHit = await this.prisma.badBeatJackpot.findFirst({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return {
      enabled: room.badBeatJackpotEnabled,
      currentAmount: room.currentJackpotAmount,
      lastHit: lastHit?.createdAt.toISOString(),
    };
  }

  /**
   * Check if a showdown qualifies as a bad beat and distribute if so.
   * Returns the bad beat result if triggered, null otherwise.
   */
  async recordAndDistribute(
    showdownResult: ShowdownResult,
  ): Promise<BadBeatEligibility | null> {
    // Check if room has bad beat enabled
    const room = await this.prisma.room.findUnique({
      where: { id: showdownResult.roomId },
      select: {
        badBeatJackpotEnabled: true,
        currentJackpotAmount: true,
        tier: true,
      },
    });

    if (!room || !room.badBeatJackpotEnabled) {
      return null;
    }

    // Check if bad beat occurred
    const badBeatResult = isBadBeat(showdownResult);
    if (!badBeatResult.triggered || !badBeatResult.eligible) {
      return null;
    }

    const { eligible } = badBeatResult;
    const jackpotAmount = room.currentJackpotAmount;
    const tier = room.tier ?? 'LOW';
    const resetAmount = JACKPOT_RESET_AMOUNTS[tier] ?? DEFAULT_RESET_AMOUNT;

    // Calculate payouts (amounts in cents, jackpotAmount is bigint)
    const loserPayout =
      (jackpotAmount * BigInt(PAYOUT_LOSER_PERCENT)) / BigInt(100);
    const winnerPayout =
      (jackpotAmount * BigInt(PAYOUT_WINNER_PERCENT)) / BigInt(100);
    const tablePayoutTotal = jackpotAmount - loserPayout - winnerPayout;

    // Find all players at the table (including those who folded)
    const tablePlayerIds = showdownResult.players.map((p) => p.playerId);
    const tablePlayersCount = tablePlayerIds.length;

    // Table player payout: distribute remaining 25% equally
    // Exclude loser and winner from table players
    const tablePlayersExcludingMain = tablePlayerIds.filter(
      (id) => id !== eligible.loserId && id !== eligible.winnerId,
    );
    const tablePlayerCount = tablePlayersExcludingMain.length;

    let tablePlayerShare = BigInt(0);
    if (tablePlayerCount > 0) {
      tablePlayerShare = tablePayoutTotal / BigInt(tablePlayerCount);
    }

    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // 1. Create BadBeatJackpot record
      const jackpot = await tx.badBeatJackpot.create({
        data: {
          handId: showdownResult.handId,
          tableId: showdownResult.tableId,
          roomId: showdownResult.roomId,
          jackpotAmount: jackpotAmount,
          loserId: eligible.loserId,
          loserHand: eligible.loserHand,
          winnerId: eligible.winnerId,
          winnerHand: eligible.winnerHand,
          netLoss: BigInt(eligible.netLoss),
        },
      });

      // 2. Create BadBeatPayout records
      const payoutData: Prisma.BadBeatPayoutCreateManyInput[] = [];

      // Loser payout
      payoutData.push({
        jackpotId: jackpot.id,
        userId: eligible.loserId,
        type: 'LOSER',
        amount: loserPayout,
      });

      // Winner payout
      payoutData.push({
        jackpotId: jackpot.id,
        userId: eligible.winnerId,
        type: 'WINNER',
        amount: winnerPayout,
      });

      // Table player payouts
      for (const playerId of tablePlayersExcludingMain) {
        payoutData.push({
          jackpotId: jackpot.id,
          userId: playerId,
          type: 'TABLE_PLAYER',
          amount: tablePlayerShare,
        });
      }

      await tx.badBeatPayout.createMany({ data: payoutData });

      // 3. Create Settlement records for each payout (chips credited to players)
      const settlementData: Prisma.SettlementCreateManyInput[] = [];
      const transactionData: Prisma.TransactionCreateManyInput[] = [];

      const addPayoutSettlement = async (
        userId: string,
        amount: bigint,
        type: string,
      ) => {
        if (amount <= 0) return;
        settlementData.push({
          handId: showdownResult.handId,
          userId,
          amount: Number(amount) / 100, // convert cents to chips (dollars)
          rakeAmount: 0,
        });
        transactionData.push({
          userId,
          amount: Number(amount) / 100,
          type: 'GAME_WIN',
        });
      };

      await addPayoutSettlement(eligible.loserId, loserPayout, 'LOSER');
      await addPayoutSettlement(eligible.winnerId, winnerPayout, 'WINNER');
      for (const playerId of tablePlayersExcludingMain) {
        await addPayoutSettlement(playerId, tablePlayerShare, 'TABLE_PLAYER');
      }

      if (settlementData.length > 0) {
        await tx.settlement.createMany({ data: settlementData });
      }
      if (transactionData.length > 0) {
        await tx.transaction.createMany({ data: transactionData });
      }

      // 4. Reset Room.currentJackpotAmount to initial amount
      await tx.room.update({
        where: { id: showdownResult.roomId },
        data: { currentJackpotAmount: BigInt(resetAmount) },
      });
    });

    this.logger.log(
      `Bad Beat Jackpot triggered: room=${showdownResult.roomId} hand=${showdownResult.handId} ` +
        `amount=${jackpotAmount} loser=${eligible.loserId} winner=${eligible.winnerId}`,
    );

    return badBeatResult;
  }
}
