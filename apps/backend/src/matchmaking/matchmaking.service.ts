import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type BlindTier = 'MICRO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM';

export const BLIND_TIERS: Record<
  BlindTier,
  { blindSmall: number; blindBig: number; minBuyIn: number; maxPlayers: number; label: string }
> = {
  MICRO:   { blindSmall: 5,   blindBig: 10,  minBuyIn: 100,  maxPlayers: 6, label: '5/10'    },
  LOW:     { blindSmall: 10,  blindBig: 20,  minBuyIn: 200,  maxPlayers: 6, label: '10/20'   },
  MEDIUM:  { blindSmall: 25,  blindBig: 50,  minBuyIn: 500,  maxPlayers: 9, label: '25/50'   },
  HIGH:    { blindSmall: 50,  blindBig: 100, minBuyIn: 1000, maxPlayers: 9, label: '50/100'  },
  PREMIUM: { blindSmall: 100, blindBig: 200, minBuyIn: 2000, maxPlayers: 6, label: '100/200' },
};

export interface HandResultEntry {
  playerId: string;
  winAmount: number;
  totalBet: number;
}

const ELO_K = 16;
const ELO_MIN = 100;
const ELO_MATCH_RANGE = 200;
const COLLUSION_HAND_THRESHOLD = 20; // shared hands in last 24h before we consider collusion risk

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  /** roomId → { userId → elo } — tracks ELOs of seated players for avg-ELO matching */
  private readonly roomElos = new Map<string, Map<string, number>>();

  /** roomId → Set<ipHash> — tracks hashed IPs per room for same-IP anti-cheat */
  private readonly roomIps = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public helpers ─────────────────────────────────────────────────────────

  hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex');
  }

  async getPlayerElo(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { elo: true },
    });
    return user?.elo ?? 1000;
  }

  // ─── Room tracking ───────────────────────────────────────────────────────────

  recordPlayerJoined(roomId: string, userId: string, elo: number, ipHash: string): void {
    if (!this.roomElos.has(roomId)) this.roomElos.set(roomId, new Map());
    if (!this.roomIps.has(roomId)) this.roomIps.set(roomId, new Set());
    this.roomElos.get(roomId)!.set(userId, elo);
    this.roomIps.get(roomId)!.add(ipHash);
  }

  recordPlayerLeft(roomId: string, userId: string): void {
    this.roomElos.get(roomId)?.delete(userId);
    // We don't remove from roomIps to keep the IP slot blocked while room is active
    if (this.roomElos.get(roomId)?.size === 0) {
      this.roomElos.delete(roomId);
      this.roomIps.delete(roomId);
    }
  }

  // ─── Matching logic ──────────────────────────────────────────────────────────

  /**
   * Find an existing matchmaking room that fits, or create a new one.
   * Returns the roomId to join.
   */
  async findOrCreateMatchmakingRoom(
    userId: string,
    tier: BlindTier,
    playerElo: number,
    ipHash: string,
  ): Promise<string> {
    const config = BLIND_TIERS[tier];

    const candidateRooms = await this.prisma.room.findMany({
      where: { tier, isMatchmaking: true, status: 'ACTIVE' },
      include: { tables: { select: { id: true } } },
      orderBy: { createdAt: 'asc' },
    });

    for (const room of candidateRooms) {
      if (!(await this.isRoomSuitable(room.id, userId, playerElo, ipHash, config.maxPlayers))) {
        continue;
      }
      this.logger.log(`Quick-match: player ${userId} → existing room ${room.id} (tier=${tier})`);
      return room.id;
    }

    // No suitable room found — create one
    const newRoom = await this.prisma.room.create({
      data: {
        name: `[Match] ${tier} #${Math.floor(Math.random() * 9000) + 1000}`,
        blindSmall: config.blindSmall,
        blindBig: config.blindBig,
        maxPlayers: config.maxPlayers,
        minBuyIn: config.minBuyIn,
        isMatchmaking: true,
        tier,
      },
    });
    this.logger.log(`Quick-match: player ${userId} → new room ${newRoom.id} (tier=${tier})`);
    return newRoom.id;
  }

  // ─── ELO updates ────────────────────────────────────────────────────────────

  /**
   * Recalculate and persist ELO changes after a hand.
   * Uses tournament-style formula: Δelo = K × (actual − 1/N)
   */
  async updateElo(handResult: HandResultEntry[]): Promise<void> {
    if (!handResult || handResult.length < 2) return;

    const participants = handResult.filter((r) => r.totalBet > 0 || r.winAmount > 0);
    if (participants.length < 2) return;

    const n = participants.length;
    const totalPot = participants.reduce((s, r) => s + r.winAmount, 0);

    // Determine actual score: winner(s) share 1.0, losers get 0.0
    // If split pot, each winner gets share proportional to their win vs total pot
    const updates: { userId: string; delta: number }[] = participants.map((r) => {
      const actualScore = totalPot > 0 ? r.winAmount / totalPot : 1 / n;
      const expectedScore = 1 / n;
      const delta = Math.round(ELO_K * (actualScore - expectedScore));
      return { userId: r.playerId, delta };
    });

    try {
      await this.prisma.$transaction(
        updates.map(({ userId, delta }) =>
          this.prisma.user.update({
            where: { id: userId },
            data: { elo: { increment: delta } },
          }),
        ),
      );

      // Enforce floor
      await this.prisma.user.updateMany({
        where: { elo: { lt: ELO_MIN } },
        data: { elo: ELO_MIN },
      });
    } catch (err) {
      this.logger.error('Failed to update ELO', err);
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async isRoomSuitable(
    roomId: string,
    userId: string,
    playerElo: number,
    ipHash: string,
    maxPlayers: number,
  ): Promise<boolean> {
    // Check available seats via in-memory ELO map (same size as seated players)
    const eloMap = this.roomElos.get(roomId);
    const seatedCount = eloMap?.size ?? 0;
    if (seatedCount >= maxPlayers) return false;

    // ELO range check
    if (eloMap && eloMap.size > 0) {
      const avgElo =
        Array.from(eloMap.values()).reduce((s, e) => s + e, 0) / eloMap.size;
      if (Math.abs(avgElo - playerElo) > ELO_MATCH_RANGE) return false;
    }

    // IP anti-cheat: reject if same IP already in room
    const ips = this.roomIps.get(roomId);
    if (ips?.has(ipHash)) return false;

    // Collusion check: don't match players who've been at the same table too recently
    if (eloMap && eloMap.size > 0) {
      const existingIds = Array.from(eloMap.keys());
      const hasCollusion = await this.checkCollusion(userId, existingIds);
      if (hasCollusion) return false;
    }

    return true;
  }

  /**
   * Returns true if userId has shared more than COLLUSION_HAND_THRESHOLD hands
   * with any of the otherUserIds in the last 24 hours.
   */
  async checkCollusion(userId: string, otherUserIds: string[]): Promise<boolean> {
    if (otherUserIds.length === 0) return false;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Hands that userId participated in during last 24h
    const userHandIds = await this.prisma.handAction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { handId: true },
      distinct: ['handId'],
    });

    if (userHandIds.length === 0) return false;
    const handIds = userHandIds.map((h) => h.handId);

    for (const otherId of otherUserIds) {
      const sharedCount = await this.prisma.handAction.count({
        where: { userId: otherId, handId: { in: handIds } },
      });
      if (sharedCount > COLLUSION_HAND_THRESHOLD) {
        this.logger.warn(
          `Collusion risk: ${userId} & ${otherId} shared ${sharedCount} hands in 24h`,
        );
        return true;
      }
    }

    return false;
  }
}
