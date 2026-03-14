import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  private static readonly STARTING_CHIPS = 10000;

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

    await this.prisma.$transaction(
      entries.flatMap(({ userId, balance }) => {
        const normalized = Math.max(0, balance);
        return [
          this.prisma.wallet.upsert({
            where: { userId },
            update: {
              chips: normalized,
              frozenChips: frozen ? normalized : 0,
            },
            create: {
              userId,
              chips: normalized,
              frozenChips: frozen ? normalized : 0,
            },
          }),
          this.prisma.user.update({
            where: { id: userId },
            data: { coinBalance: normalized },
          }),
        ];
      }),
    );
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

