import { Injectable, Logger } from '@nestjs/common';
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
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { rakebackBalance: { increment: rakebackAmount } },
        }),
      ]);

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
