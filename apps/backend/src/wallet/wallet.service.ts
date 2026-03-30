import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class WalletService {
  private static readonly STARTING_CHIPS = 10000;
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns the player's current chip count (game currency). */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { chips: true },
    });

    if (wallet) {
      return wallet.chips;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true },
    });

    return user?.coinBalance ?? WalletService.STARTING_CHIPS;
  }

  /** Overwrites a single player's chip balance. Also syncs User.coinBalance. */
  async setBalance(userId: string, balance: number): Promise<void> {
    const normalized = Math.max(0, balance);

    await this.prisma.$transaction([
      this.prisma.wallet.upsert({
        where: { userId },
        update: { chips: normalized },
        create: { userId, chips: normalized },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { coinBalance: normalized },
      }),
    ]);
  }

  /**
   * Batch-update chip balances for multiple players.
   * When `frozen = true` the frozenChips field is also set to the new chip
   * count (player is still seated at a table — prevents double-spend).
   */
  async setBalances(
    entries: Array<{ userId: string; balance: number }>,
    frozen = false,
  ): Promise<void> {
    if (entries.length === 0) return;

    // Phase 1: upsert wallets only — skip bots (no wallet record needed for bots)
    const walletOps = entries.map(async ({ userId, balance }) => {
      try {
        const normalized = Math.max(0, balance);
        await this.prisma.wallet.upsert({
          where: { userId },
          update: { chips: normalized, frozenChips: frozen ? normalized : 0 },
          create: {
            userId,
            chips: normalized,
            frozenChips: frozen ? normalized : 0,
          },
        });
      } catch (err) {
        this.logger.error(
          `[Wallet] setBalances wallet.upsert failed for ${userId}: ${err.message}`,
        );
      }
    });

    await Promise.all(walletOps);

    // Phase 2: update User.coinBalance — skip bots and users without a User record
    const userOps = entries
      .filter(({ userId }) => !userId.startsWith('bot_'))
      .map(async ({ userId, balance }) => {
        try {
          const normalized = Math.max(0, balance);
          await this.prisma.user.update({
            where: { id: userId },
            data: { coinBalance: normalized },
          });
        } catch (err) {
          if (
            err instanceof PrismaClientKnownRequestError &&
            err.code === 'P2025'
          ) {
            // User record not found — ignore (e.g. bot users)
            this.logger.warn(
              `[Wallet] No User record for ${userId}, skipping coinBalance sync`,
            );
          } else {
            this.logger.error(
              `[Wallet] setBalances user.update failed for ${userId}: ${err.message}`,
            );
          }
        }
      });

    await Promise.all(userOps);
  }

  /**
   * Lock a player's chips when they sit at a table.
   * The entire stack is frozen so they cannot join a second table.
   */
  async freezeBalance(userId: string, amount: number): Promise<void> {
    const normalized = Math.max(0, amount);
    await this.prisma.wallet.upsert({
      where: { userId },
      update: { frozenChips: normalized },
      create: { userId, chips: normalized, frozenChips: normalized },
    });
  }

  /** Release frozen chips when a player leaves a table. */
  async unfreezeBalance(userId: string): Promise<void> {
    await this.prisma.wallet.updateMany({
      where: { userId },
      data: { frozenChips: 0 },
    });
  }

  /**
   * Spendable (non-frozen) chips.
   * While seated, frozenChips == chips, so availableBalance == 0.
   */
  async getAvailableBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { chips: true, frozenChips: true },
    });

    if (!wallet) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { coinBalance: true },
      });
      return user?.coinBalance ?? WalletService.STARTING_CHIPS;
    }

    return Math.max(0, wallet.chips - wallet.frozenChips);
  }
}
