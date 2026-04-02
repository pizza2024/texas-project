import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export interface UserStats {
  handsPlayed: number;
  handsWon: number;
  winRate: number;
  totalProfit: number;
  biggestWin: number;
  biggestLoss: number;
  recentHands: Array<{
    id: string;
    potSize: number;
    profit: number;
    createdAt: string;
  }>;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async user(
    userWhereUniqueInput: Prisma.UserWhereUniqueInput,
  ): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: userWhereUniqueInput,
    });
  }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return this.prisma.user.update({
      data,
      where,
    });
  }

  async updateAvatar(userId: string, avatarUrl: string | null): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });
  }

  async getUserAvatar(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });
    return user?.avatar ?? null;
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const [
      handsPlayed,
      handsWon,
      profitAggregate,
      biggestWinTx,
      biggestLossTx,
      recentTransactions,
    ] = await Promise.all([
      this.prisma.settlement.count({ where: { userId } }),
      this.prisma.hand.count({ where: { winnerId: userId } }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { userId, type: { in: ['GAME_WIN', 'GAME_LOSS'] } },
      }),
      this.prisma.transaction.findFirst({
        where: { userId, type: 'GAME_WIN' },
        orderBy: { amount: 'desc' },
      }),
      this.prisma.transaction.findFirst({
        where: { userId, type: 'GAME_LOSS' },
        orderBy: { amount: 'asc' },
      }),
      this.prisma.transaction.findMany({
        where: { userId, type: { in: ['GAME_WIN', 'GAME_LOSS'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const winRate =
      handsPlayed === 0
        ? 0
        : parseFloat(((handsWon / handsPlayed) * 100).toFixed(2));

    return {
      handsPlayed,
      handsWon,
      winRate,
      totalProfit: profitAggregate._sum.amount ?? 0,
      biggestWin: biggestWinTx?.amount ?? 0,
      biggestLoss: biggestLossTx?.amount ?? 0,
      recentHands: recentTransactions.map((t) => ({
        id: t.id,
        potSize: 0,
        profit: t.amount,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findByEmailVerificationCode(code: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        emailVerificationCode: code,
        emailVerificationExpiry: { gt: new Date() },
      },
    });
  }

  async setEmailVerification(
    userId: string,
    code: string,
    expiry: Date,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationCode: code,
        emailVerificationExpiry: expiry,
      },
    });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpiry: null,
      },
    });
  }
}
