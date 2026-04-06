import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { RedisService } from '../redis/redis.service';

const OVERVIEW_CACHE_KEY = 'admin:overview';
const OVERVIEW_CACHE_TTL_SECONDS = 60;

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

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

  async getUsers(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }) {
    const { page, limit, search, status } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
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

  async updateUser(
    id: string,
    data: { nickname?: string; status?: string; role?: string },
  ) {
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

  async adjustBalance(
    userId: string,
    amount: number,
    reason: string,
    adminId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Guard against negative resulting balance
    if (amount < 0 && user.coinBalance + amount < 0) {
      throw new BadRequestException('操作后余额不能为负数');
    }

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

  async getRooms(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }) {
    const { page, limit, search, status } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.RoomWhereInput = {};
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

  async updateRoom(id: string, data: Prisma.RoomUpdateInput) {
    return this.prisma.room.update({ where: { id }, data });
  }

  async deleteRoom(id: string, adminId: string) {
    await this.log({
      adminId,
      action: 'DELETE_ROOM',
      targetType: 'ROOM',
      targetId: id,
    });
    return this.prisma.room.delete({ where: { id } });
  }

  async createRoom(data: Prisma.RoomCreateInput) {
    return this.prisma.room.create({ data });
  }

  // ── Finance ──────────────────────────────────────────────

  async getTransactions(query: {
    page: number;
    limit: number;
    type?: string;
    userId?: string;
  }) {
    const { page, limit, type, userId } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.TransactionWhereInput = {};
    if (type) where.type = type;
    if (userId) where.userId = userId;

    const [total, data] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, username: true } },
        },
      }),
    ]);

    return { total, page, limit, data };
  }

  async getFinanceSummary() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalUsers, totalDeposit, dayFlow, weekFlow, monthFlow] =
      await Promise.all([
        this.prisma.user.aggregate({ _sum: { coinBalance: true } }),
        this.prisma.transaction.aggregate({
          where: { type: 'DEPOSIT' },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { createdAt: { gte: dayStart } },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { createdAt: { gte: weekStart } },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { createdAt: { gte: monthStart } },
          _sum: { amount: true },
        }),
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
    const cached = await this.redis.get(OVERVIEW_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as {
          totalUsers: number;
          activeRooms: number;
          totalHands: number;
          todayTransactions: number;
          todayFlow: number;
        };
      } catch {
        // Corrupt cache — fall through to DB
      }
    }

    const [totalUsers, activeRooms, totalHands, recentTransactions] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.room.count({ where: { status: 'ACTIVE' } }),
        this.prisma.hand.count(),
        this.prisma.transaction.aggregate({
          where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

    const result = {
      totalUsers,
      activeRooms,
      totalHands,
      todayTransactions: recentTransactions._count,
      todayFlow: recentTransactions._sum.amount ?? 0,
    };

    await this.redis.set(
      OVERVIEW_CACHE_KEY,
      JSON.stringify(result),
      OVERVIEW_CACHE_TTL_SECONDS,
    );

    return result;
  }

  async getUserGrowth(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const users = await this.prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT DATE("createdAt")::text AS date, COUNT(*)::bigint AS count
      FROM users
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Build a map for quick lookup
    const countMap = new Map<string, number>();
    for (const row of users) {
      countMap.set(String(row.date), Number(row.count));
    }

    // Fill in all days (including zeros)
    const results: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      results.push({ date: dateStr, count: countMap.get(dateStr) ?? 0 });
    }
    return results;
  }

  async getRevenueByPeriod(period: 'day' | 'week' | 'month' = 'day', n = 30) {
    // Whitelist: complete SQL strings for each period — no dynamic SQL construction,
    // eliminating any risk of SQL injection from the period parameter
    const QUERY_BY_PERIOD: Record<string, string> = {
      day: `SELECT DATE("createdAt")::text AS date, COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::float AS amount FROM transactions WHERE "createdAt" >= $1 AND "createdAt" <= $2 GROUP BY DATE("createdAt") ORDER BY date ASC`,
      week: `SELECT DATE(DATE_TRUNC('week', "createdAt"))::text AS date, COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::float AS amount FROM transactions WHERE "createdAt" >= $1 AND "createdAt" <= $2 GROUP BY DATE(DATE_TRUNC('week', "createdAt")) ORDER BY date ASC`,
      month: `SELECT TO_CHAR("createdAt", 'YYYY-MM')::text AS date, COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::float AS amount FROM transactions WHERE "createdAt" >= $1 AND "createdAt" <= $2 GROUP BY TO_CHAR("createdAt", 'YYYY-MM') ORDER BY date ASC`,
    };

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    if (period === 'day') startDate.setDate(startDate.getDate() - (n - 1));
    else if (period === 'week')
      startDate.setDate(startDate.getDate() - (n - 1) * 7);
    else startDate.setMonth(startDate.getMonth() - (n - 1));
    startDate.setHours(0, 0, 0, 0);

    const sql = QUERY_BY_PERIOD[period];
    if (!sql) throw new Error(`Invalid period: ${period}`);

    const rows = await (this.prisma.$queryRawUnsafe as (
      sql: string,
      ...args: (string | number | boolean | Date | null)[]
    ) => Promise<{ date: string; amount: number }[]>)
    (sql, startDate, endDate);

    const amountMap = new Map<string, number>();
    for (const row of rows) {
      amountMap.set(String(row.date), Number(row.amount));
    }

    const results: { date: string; amount: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      if (period === 'day') d.setDate(d.getDate() - i);
      else if (period === 'week') d.setDate(d.getDate() - i * 7);
      else d.setMonth(d.getMonth() - i);
      d.setHours(0, 0, 0, 0);
      let dateStr: string;
      if (period === 'month') {
        dateStr = d.toISOString().slice(0, 7);
      } else {
        dateStr = d.toISOString().split('T')[0];
      }
      results.push({ date: dateStr, amount: amountMap.get(dateStr) ?? 0 });
    }
    return results;
  }

  async getRoomHotList() {
    // Use a single aggregation query instead of fetching all rooms + tables + hands
    const hotRooms = await this.prisma.$queryRaw<
      { id: string; name: string; status: string; handCount: number }[]
    >`
      SELECT r.id, r.name, r.status,
             COALESCE(hc.hand_count, 0)::int AS "handCount"
      FROM rooms r
      LEFT JOIN (
        SELECT "tableId", COUNT(*)::int AS hand_count
        FROM hands
        GROUP BY "tableId"
      ) hc ON hc."tableId" = r.id
      ORDER BY "handCount" DESC
      LIMIT 10
    `;
    return hotRooms.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      handCount: Number(r.handCount),
    }));
  }

  async getHandsStats() {
    const [total, avgPot] = await Promise.all([
      this.prisma.hand.count(),
      this.prisma.hand.aggregate({
        _avg: { potSize: true },
        _sum: { potSize: true },
      }),
    ]);
    return {
      total,
      avgPot: avgPot._avg.potSize ?? 0,
      totalPot: avgPot._sum.potSize ?? 0,
    };
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
        include: {
          admin: { select: { id: true, nickname: true, username: true } },
        },
      }),
    ]);
    return { total, page, limit, data };
  }
}
