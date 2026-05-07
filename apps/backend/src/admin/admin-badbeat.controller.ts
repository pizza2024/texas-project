import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AdminGuard } from './guards/admin.guard';
import { BadBeatJackpotService } from '../table-engine/badbeat.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginateBadBeatDto } from './dto/badbeat-payout.dto';

@Controller('admin/badbeat')
@UseGuards(AdminGuard)
export class AdminBadBeatController {
  constructor(
    private badBeatService: BadBeatJackpotService,
    private prisma: PrismaService,
  ) {}

  /**
   * GET /admin/badbeat
   * Paginated list of all bad beat jackpot events.
   */
  @Get()
  async getJackpots(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('handId') handId?: string,
    @Query('userId') userId?: string,
    @Query('roomId') roomId?: string,
  ) {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (handId) where.handId = handId;
    if (roomId) where.roomId = roomId;

    // If filtering by userId, need to check in payouts
    if (userId) {
      const jackpotIds = await this.prisma.badBeatPayout.findMany({
        where: { userId },
        select: { jackpotId: true },
        distinct: ['jackpotId'],
      });
      where.id = { in: jackpotIds.map((j) => j.jackpotId) };
    }

    const [jackpots, total] = await Promise.all([
      this.prisma.badBeatJackpot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          payouts: {
            select: {
              userId: true,
              type: true,
              amount: true,
            },
          },
        },
      }),
      this.prisma.badBeatJackpot.count({ where }),
    ]);

    // Convert BigInt to number for JSON serialization
    const data = jackpots.map((j) => ({
      ...j,
      jackpotAmount: Number(j.jackpotAmount),
      netLoss: Number(j.netLoss),
      payouts: j.payouts.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    }));

    return { data, total, page, limit };
  }

  /**
   * GET /admin/badbeat/stats
   * Aggregate statistics for bad beat jackpots.
   */
  @Get('stats')
  async getStats() {
    const [totalJackpots, totalPayouts, avgResult, lastTriggered] =
      await Promise.all([
        this.prisma.badBeatJackpot.count(),
        this.prisma.badBeatPayout.aggregate({
          _sum: { amount: true },
        }),
        this.prisma.badBeatJackpot.aggregate({
          _avg: { jackpotAmount: true },
        }),
        this.prisma.badBeatJackpot.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, jackpotAmount: true, roomId: true },
        }),
      ]);

    return {
      totalJackpots,
      totalPayouts: Number(totalPayouts._sum.amount ?? 0),
      averageJackpot: Math.round(Number(avgResult._avg.jackpotAmount ?? 0)),
      lastTriggered: lastTriggered
        ? {
            at: lastTriggered.createdAt.toISOString(),
            amount: Number(lastTriggered.jackpotAmount),
            roomId: lastTriggered.roomId,
          }
        : null,
    };
  }

  /**
   * GET /admin/badbeat/current
   * Current jackpot status for all rooms.
   */
  @Get('current')
  async getCurrent() {
    const rooms = await this.prisma.room.findMany({
      where: {
        badBeatJackpotEnabled: true,
        currentJackpotAmount: { not: BigInt(0) },
      },
      select: {
        id: true,
        name: true,
        tier: true,
        badBeatJackpotEnabled: true,
        currentJackpotAmount: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get last hit for each room
    const roomIds = rooms.map((r) => r.id);
    const lastHits = await this.prisma.badBeatJackpot.findMany({
      where: { roomId: { in: roomIds } },
      orderBy: { createdAt: 'desc' },
      select: { roomId: true, createdAt: true },
      distinct: ['roomId'],
    });

    const lastHitMap = new Map(
      lastHits.map((h) => [h.roomId, h.createdAt.toISOString()]),
    );

    return rooms.map((room) => ({
      roomId: room.id,
      roomName: room.name,
      tier: room.tier,
      enabled: room.badBeatJackpotEnabled,
      currentAmount: Number(room.currentJackpotAmount),
      lastHit: lastHitMap.get(room.id) ?? null,
    }));
  }
}
