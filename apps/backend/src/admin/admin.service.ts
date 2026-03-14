import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string;
    detail?: object;
  }) {
    return this.prisma.adminLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        detail: params.detail ? JSON.stringify(params.detail) : null,
      },
    });
  }

  // ── Users ────────────────────────────────────────────────

  async getUsers(query: { page: number; limit: number; search?: string; status?: string }) {
    const { page, limit, search, status } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { nickname: { contains: search } },
      ];
    }
    if (status) where.status = status;

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          nickname: true,
          avatar: true,
          role: true,
          status: true,
          coinBalance: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, data: users };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
        role: true,
        status: true,
        coinBalance: true,
        createdAt: true,
        lastLoginAt: true,
        wallet: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(id: string, data: { nickname?: string; status?: string; role?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async getUserTransactions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.transaction.count({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { total, page, limit, data };
  }

  async getUserHands(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.hand.count({ where: { winnerId: userId } }),
      this.prisma.hand.findMany({
        where: { winnerId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { table: { include: { room: true } } },
      }),
    ]);
    return { total, page, limit, data };
  }

  async adjustBalance(userId: string, amount: number, reason: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: amount } },
      }),
      this.prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: amount } },
      }),
      this.prisma.transaction.create({
        data: {
          userId,
          amount,
          type: amount > 0 ? 'DEPOSIT' : 'WITHDRAW',
        },
      }),
    ]);

    await this.log({
      adminId,
      action: 'ADJUST_BALANCE',
      targetType: 'USER',
      targetId: userId,
      detail: { amount, reason, previousBalance: user.coinBalance },
    });

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, coinBalance: true },
    });
  }

  // ── Rooms ────────────────────────────────────────────────

  async getRooms(query: { page: number; limit: number; search?: string; status?: string }) {
    const { page, limit, search, status } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) where.name = { contains: search };
    if (status) where.status = status;

    const [total, rooms] = await Promise.all([
      this.prisma.room.count({ where }),
      this.prisma.room.findMany({
        where,
        skip,
        take: limit,
        include: { tables: { select: { id: true, state: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, data: rooms };
  }

  async getRoomById(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { tables: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async updateRoom(id: string, data: any) {
    return this.prisma.room.update({ where: { id }, data });
  }

  async deleteRoom(id: string, adminId: string) {
    await this.log({ adminId, action: 'DELETE_ROOM', targetType: 'ROOM', targetId: id });
    return this.prisma.room.delete({ where: { id } });
  }

  async createRoom(data: any) {
    return this.prisma.room.create({ data });
  }

  // ── Finance ──────────────────────────────────────────────

  async getTransactions(query: { page: number; limit: number; type?: string; userId?: string }) {
    const { page, limit, type, userId } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (type) where.type = type;
    if (userId) where.userId = userId;

    const [total, data] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, nickname: true, username: true } } },
      }),
    ]);

    return { total, page, limit, data };
  }

  async getFinanceSummary() {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [totalUsers, totalDeposit, dayFlow, weekFlow, monthFlow] = await Promise.all([
      this.prisma.user.aggregate({ _sum: { coinBalance: true } }),
      this.prisma.transaction.aggregate({ where: { type: 'DEPOSIT' }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { createdAt: { gte: dayStart } }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { createdAt: { gte: weekStart } }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    ]);

    return {
      totalAssets: totalUsers._sum.coinBalance ?? 0,
      totalDeposit: totalDeposit._sum.amount ?? 0,
      dayFlow: dayFlow._sum.amount ?? 0,
      weekFlow: weekFlow._sum.amount ?? 0,
      monthFlow: monthFlow._sum.amount ?? 0,
    };
  }

  // ── Analytics ────────────────────────────────────────────

  async getOverview() {
    const [totalUsers, activeRooms, totalHands, recentTransactions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.room.count({ where: { status: 'ACTIVE' } }),
      this.prisma.hand.count(),
      this.prisma.transaction.aggregate({
        where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalUsers,
      activeRooms,
      totalHands,
      todayTransactions: recentTransactions._count,
      todayFlow: recentTransactions._sum.amount ?? 0,
    };
  }

  async getUserGrowth(days = 30) {
    const results: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const count = await this.prisma.user.count({ where: { createdAt: { gte: d, lt: next } } });
      results.push({ date: d.toISOString().split('T')[0], count });
    }
    return results;
  }

  async getRevenueByPeriod(period: 'day' | 'week' | 'month' = 'day', n = 30) {
    const results: { date: string; amount: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      if (period === 'day') d.setDate(d.getDate() - i);
      else if (period === 'week') d.setDate(d.getDate() - i * 7);
      else d.setMonth(d.getMonth() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      if (period === 'day') next.setDate(d.getDate() + 1);
      else if (period === 'week') next.setDate(d.getDate() + 7);
      else next.setMonth(d.getMonth() + 1);

      const agg = await this.prisma.transaction.aggregate({
        where: { createdAt: { gte: d, lt: next }, amount: { gt: 0 } },
        _sum: { amount: true },
      });
      results.push({ date: d.toISOString().split('T')[0], amount: agg._sum.amount ?? 0 });
    }
    return results;
  }

  async getRoomHotList() {
    const rooms = await this.prisma.room.findMany({
      include: {
        tables: {
          include: {
            hands: { select: { id: true } },
          },
        },
      },
    });

    return rooms
      .map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        handCount: r.tables.reduce((sum, t) => sum + t.hands.length, 0),
      }))
      .sort((a, b) => b.handCount - a.handCount)
      .slice(0, 10);
  }

  async getHandsStats() {
    const [total, avgPot] = await Promise.all([
      this.prisma.hand.count(),
      this.prisma.hand.aggregate({ _avg: { potSize: true }, _sum: { potSize: true } }),
    ]);
    return { total, avgPot: avgPot._avg.potSize ?? 0, totalPot: avgPot._sum.potSize ?? 0 };
  }

  // ── System ───────────────────────────────────────────────

  async getAdminLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.adminLog.count(),
      this.prisma.adminLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, nickname: true, username: true } } },
      }),
    ]);
    return { total, page, limit, data };
  }
}
