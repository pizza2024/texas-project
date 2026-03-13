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

  async setBalances(entries: Array<{ userId: string; balance: number }>): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      entries.flatMap(({ userId, balance }) => {
        const normalizedBalance = Math.max(0, balance);
        return [
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
        ];
      }),
    );
  }
}
