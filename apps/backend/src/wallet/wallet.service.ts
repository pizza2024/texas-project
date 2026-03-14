import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  private static readonly STARTING_BALANCE = 10000;

  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    });

    if (wallet) {
      return wallet.balance;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true },
    });

    return user?.coinBalance ?? WalletService.STARTING_BALANCE;
  }

  async setBalance(userId: string, balance: number): Promise<void> {
    const normalizedBalance = Math.max(0, balance);

    await this.prisma.$transaction([
      this.prisma.wallet.upsert({
        where: { userId },
        update: { balance: normalizedBalance },
        create: {
          userId,
          balance: normalizedBalance,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { coinBalance: normalizedBalance },
      }),
    ]);
  }

  async setBalances(
    entries: Array<{ userId: string; balance: number }>,
    /** When true, frozenBalance is also set to the new balance (player still seated at a table). */
    frozen = false,
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      entries.flatMap(({ userId, balance }) => {
        const normalizedBalance = Math.max(0, balance);
        return [
          this.prisma.wallet.upsert({
            where: { userId },
            update: {
              balance: normalizedBalance,
              frozenBalance: frozen ? normalizedBalance : 0,
            },
            create: {
              userId,
              balance: normalizedBalance,
              frozenBalance: frozen ? normalizedBalance : 0,
            },
          }),
          this.prisma.user.update({
            where: { id: userId },
            data: { coinBalance: normalizedBalance },
          }),
        ];
      }),
    );
  }

  /**
   * Freeze the player's entire balance when they sit down at a table.
   * This prevents them from joining a second table simultaneously.
   */
  async freezeBalance(userId: string, amount: number): Promise<void> {
    const normalizedAmount = Math.max(0, amount);
    await this.prisma.wallet.upsert({
      where: { userId },
      update: { frozenBalance: normalizedAmount },
      create: { userId, balance: normalizedAmount, frozenBalance: normalizedAmount },
    });
  }

  /**
   * Unfreeze the player's balance when they leave a table.
   * Always call this alongside setBalance so the new balance is spendable.
   */
  async unfreezeBalance(userId: string): Promise<void> {
    await this.prisma.wallet.updateMany({
      where: { userId },
      data: { frozenBalance: 0 },
    });
  }

  /**
   * Returns the spendable (non-frozen) balance.
   * While a player is seated at a table their entire balance is frozen,
   * so availableBalance will be 0 until they leave.
   */
  async getAvailableBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true, frozenBalance: true },
    });

    if (!wallet) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { coinBalance: true },
      });
      return user?.coinBalance ?? WalletService.STARTING_BALANCE;
    }

    return Math.max(0, wallet.balance - wallet.frozenBalance);
  }
}
