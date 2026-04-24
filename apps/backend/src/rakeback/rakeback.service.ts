import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Rakeback tier thresholds and rates */
const TIER_THRESHOLDS = {
  BRONZE: { minRake: 0, maxRake: 999, rate: 0.1 },
  SILVER: { minRake: 1000, maxRake: 4999, rate: 0.2 },
  GOLD: { minRake: 5000, maxRake: Infinity, rate: 0.3 },
} as const;

export type RakebackTier = 'BRONZE' | 'SILVER' | 'GOLD';

@Injectable()
export class RakebackService {
  private readonly logger = new Logger(RakebackService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determines the rakeback tier and rate for a user based on their totalRake.
   */
  async getRakebackRate(
    userId: string,
  ): Promise<{ rate: number; tier: RakebackTier }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalRake: true },
    });

    if (!user) {
      return { rate: TIER_THRESHOLDS.BRONZE.rate, tier: 'BRONZE' };
    }

    const totalRake = user.totalRake;

    if (totalRake < TIER_THRESHOLDS.SILVER.minRake) {
      return { rate: TIER_THRESHOLDS.BRONZE.rate, tier: 'BRONZE' };
    }

    if (totalRake < TIER_THRESHOLDS.GOLD.minRake) {
      return { rate: TIER_THRESHOLDS.SILVER.rate, tier: 'SILVER' };
    }

    return { rate: TIER_THRESHOLDS.GOLD.rate, tier: 'GOLD' };
  }

  /**
   * Gets the user's rakeback info including balance, tier, rate, and progress to next tier.
   */
  async getRakeback(userId: string): Promise<{
    rakebackBalance: number;
    tier: RakebackTier;
    rate: number;
    totalRake: number;
    minRakeForNextTier: number | null;
    rakeToNextTier: number | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { rakebackBalance: true, totalRake: true },
    });

    if (!user) {
      return {
        rakebackBalance: 0,
        tier: 'BRONZE',
        rate: TIER_THRESHOLDS.BRONZE.rate,
        totalRake: 0,
        minRakeForNextTier: TIER_THRESHOLDS.SILVER.minRake,
        rakeToNextTier: TIER_THRESHOLDS.SILVER.minRake,
      };
    }

    const { rakebackBalance, totalRake } = user;
    const { rate, tier } = await this.getRakebackRate(userId);

    let minRakeForNextTier: number | null = null;
    let rakeToNextTier: number | null = null;

    if (tier === 'BRONZE') {
      minRakeForNextTier = TIER_THRESHOLDS.SILVER.minRake;
      rakeToNextTier = TIER_THRESHOLDS.SILVER.minRake - totalRake;
    } else if (tier === 'SILVER') {
      minRakeForNextTier = TIER_THRESHOLDS.GOLD.minRake;
      rakeToNextTier = TIER_THRESHOLDS.GOLD.minRake - totalRake;
    }

    return {
      rakebackBalance,
      tier,
      rate,
      totalRake,
      minRakeForNextTier,
      rakeToNextTier,
    };
  }

  /**
   * Claims the user's rakeback balance by transferring it to their wallet chips.
   * Uses atomic transaction to prevent race conditions.
   */
  async claimRakeback(userId: string): Promise<{
    claimedAmount: number;
    newChipsBalance: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { rakebackBalance: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const rakebackBalance = user.rakebackBalance;

    if (rakebackBalance <= 0) {
      throw new BadRequestException('No rakeback balance to claim');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { userId },
        data: { chips: { increment: rakebackBalance } },
      });

      await tx.user.update({
        where: { id: userId },
        data: { rakebackBalance: 0 },
      });

      return { claimedAmount: rakebackBalance, newChipsBalance: wallet.chips };
    });

    this.logger.debug(
      `[claimRakeback] userId=${userId} claimed=${result.claimedAmount} newChips=${result.newChipsBalance}`,
    );

    return result;
  }

  /**
   * Credits rakeback to a user's rakebackBalance based on their current tier.
   * The rakeback is calculated from the rakeAmount contributed in this hand.
   * Uses atomic transaction to update User.rakebackBalance.
   */
  async creditRakeback(userId: string, rakeAmount: number): Promise<void> {
    if (rakeAmount <= 0) {
      return;
    }

    const { rate, tier } = await this.getRakebackRate(userId);
    const rakebackAmount = Math.floor(rakeAmount * rate);

    if (rakebackAmount <= 0) {
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { rakebackBalance: { increment: rakebackAmount } },
        });
      });

      this.logger.debug(
        `[creditRakeback] userId=${userId} tier=${tier} ` +
          `rakeAmount=${rakeAmount} rate=${rate} ` +
          `credited=${rakebackAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `[creditRakeback] Failed to credit rakeback for userId=${userId}`,
        error,
      );
      throw error;
    }
  }
}
