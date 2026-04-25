import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { RoomService } from '../room/room.service';
import { BroadcastService } from '../websocket/broadcast.service';
import { TableManagerService } from '../table-engine/table-manager.service';
import {
  SngConfig,
  BlindLevel,
  createDefaultBlindSchedule,
  SNG_MAX_PLAYERS,
  SNG_INITIAL_CHIPS,
  SNG_BLIND_DURATION_SECONDS,
  PrizeDistributionResponse,
  PrizePosition,
  TournamentType,
} from '@texas/shared/types/tournament';

/** Redis key for tournament blind timer sorted set */
const TOURNAMENT_TIMERS_KEY = 'tournament:blind_timers';

@Injectable()
export class TournamentService implements OnModuleDestroy {
  private readonly logger = new Logger(TournamentService.name);
  private readonly blindTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly walletService: WalletService,
    private readonly roomService: RoomService,
    private readonly broadcastService: BroadcastService,
    @Inject(forwardRef(() => TableManagerService))
    private readonly tableManager: TableManagerService,
  ) {}

  onModuleDestroy() {
    for (const timer of this.blindTimers.values()) {
      clearTimeout(timer);
    }
    this.blindTimers.clear();
  }

  /**
   * Create a default SNG configuration for a room.
   */
  createSngConfig(buyin: number, smallBlind: number): SngConfig {
    const totalPrize = buyin * SNG_MAX_PLAYERS;
    const blindSchedule = createDefaultBlindSchedule(smallBlind);

    return {
      type: TournamentType.SNG,
      buyin,
      maxPlayers: SNG_MAX_PLAYERS,
      prizeDistribution: [60, 30, 10],
      blindSchedule,
      currentBlindLevel: 0,
      blindLevelStartedAt: Date.now(),
      totalPrize,
    };
  }

  /**
   * Get prize distribution for a tournament room.
   */
  async getPrizeDistribution(
    roomId: string,
  ): Promise<PrizeDistributionResponse | null> {
    const room = await this.roomService.findOne(roomId);
    if (!room || !room.isTournament || !room.tournamentConfig) {
      return null;
    }

    const config = room.tournamentConfig as unknown as SngConfig;
    const positions: PrizePosition[] = config.prizeDistribution.map(
      (percentage, index) => ({
        place: index + 1,
        percentage,
        chips: Math.floor((percentage / 100) * config.totalPrize),
      }),
    );

    return {
      buyin: config.buyin,
      totalPrize: config.totalPrize,
      maxPlayers: config.maxPlayers,
      positions,
    };
  }

  /**
   * Start the blind level timer for a tournament room.
   * Called when the 8th player joins and the countdown finishes.
   */
  async startBlindTimer(
    roomId: string,
    server: import('socket.io').Server,
  ): Promise<void> {
    // Clear any existing timer
    this.clearBlindTimer(roomId);

    const room = await this.roomService.findOne(roomId);
    if (!room || !room.isTournament || !room.tournamentConfig) {
      return;
    }

    const config = room.tournamentConfig as unknown as SngConfig;
    const currentLevel = config.blindSchedule[config.currentBlindLevel];
    if (!currentLevel) {
      return;
    }

    const delayMs = SNG_BLIND_DURATION_SECONDS * 1000;
    this.logger.log(
      `Starting blind timer for room ${roomId}, level ${currentLevel.level} (${delayMs}ms)`,
    );

    const timer = setTimeout(async () => {
      await this.advanceBlindLevel(roomId, server);
    }, delayMs);

    this.blindTimers.set(roomId, timer);

    // Also schedule in Redis for distributed environments
    if (this.redis.isAvailable) {
      try {
        const score = Date.now() + delayMs;
        await this.redis.zadd(TOURNAMENT_TIMERS_KEY, score, roomId);
      } catch (err) {
        this.logger.warn(
          `Failed to add timer to Redis: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Advance to the next blind level.
   */
  async advanceBlindLevel(
    roomId: string,
    server: import('socket.io').Server,
  ): Promise<void> {
    this.blindTimers.delete(roomId);

    const room = await this.roomService.findOne(roomId);
    if (!room || !room.isTournament || !room.tournamentConfig) {
      return;
    }

    const config = room.tournamentConfig as unknown as SngConfig;
    const nextLevel = config.currentBlindLevel + 1;

    if (nextLevel >= config.blindSchedule.length) {
      this.logger.log(`Tournament ${roomId} has reached final blind level`);
      return;
    }

    // Update config
    const updatedConfig: SngConfig = {
      ...config,
      currentBlindLevel: nextLevel,
      blindLevelStartedAt: Date.now(),
    };

    await this.prisma.room.update({
      where: { id: roomId },
      data: { tournamentConfig: updatedConfig as any },
    });

    const newBlindLevel = updatedConfig.blindSchedule[nextLevel];
    this.logger.log(
      `Room ${roomId} advanced to blind level ${newBlindLevel.level}: ${newBlindLevel.smallBlind}/${newBlindLevel.bigBlind}`,
    );

    // Broadcast blind level change
    server.to(roomId).emit('tournament_blind_level', {
      roomId,
      level: newBlindLevel.level,
      smallBlind: newBlindLevel.smallBlind,
      bigBlind: newBlindLevel.bigBlind,
      nextLevelAt: Date.now() + SNG_BLIND_DURATION_SECONDS * 1000,
    });

    // Schedule next level
    await this.startBlindTimer(roomId, server);
  }

  /**
   * Stop the blind timer (e.g., when tournament ends with 3 players remaining).
   */
  clearBlindTimer(roomId: string): void {
    const existing = this.blindTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.blindTimers.delete(roomId);
    }

    // Also remove from Redis sorted set
    if (this.redis.isAvailable) {
      void this.redis.zrem(TOURNAMENT_TIMERS_KEY, roomId).catch(() => {});
    }
  }

  /**
   * Check if a tournament should stop blind increases.
   * For SNG: stops when 3 players remain.
   */
  shouldStopBlindIncreases(playerCount: number): boolean {
    // In SNG, stop increasing blinds when 3 players remain (payout reached)
    return playerCount <= 3;
  }

  /**
   * Calculate final tournament rankings based on chip counts.
   * Remaining players are sorted by chip count (descending).
   * Tied players are sorted by their seat index (lower = better).
   */
  async calculateFinalRankings(
    roomId: string,
  ): Promise<Array<{ place: number; playerId: string; chips: number }>> {
    const room = await this.roomService.findOne(roomId);
    if (!room) return [];

    const table = await this.tableManager.getTable(roomId);
    if (!table) return [];

    const balances = table.getPersistentBalances();
    if (balances.length === 0) return [];

    // Sort by chips descending (higher = better rank)
    balances.sort((a, b) => b.balance - a.balance);

    return balances.map((entry, index) => ({
      place: index + 1,
      playerId: entry.userId,
      chips: entry.balance,
    }));
  }

  /**
   * Distribute prizes to top 3 players.
   * Called when only 3 players remain.
   */
  async distributePrizes(
    roomId: string,
    rankings: Array<{ place: number; playerId: string; chips: number }>,
  ): Promise<void> {
    const room = await this.roomService.findOne(roomId);
    if (!room || !room.isTournament || !room.tournamentConfig) {
      return;
    }

    const config = room.tournamentConfig as unknown as SngConfig;
    const prizePercentages = config.prizeDistribution;

    for (const { place, playerId } of rankings.slice(0, 3)) {
      if (place > 3) break;
      const percentage = prizePercentages[place - 1] ?? 0;
      const prizeChips = Math.floor((percentage / 100) * config.totalPrize);

      if (prizeChips > 0) {
        // Award prize chips to player (unfreeze original buyin + add prize)
        await this.walletService.unfreezeAndAward(playerId, prizeChips);

        this.logger.log(
          `Tournament ${roomId}: Player ${playerId} placed ${place}, won ${prizeChips} chips (${percentage}%)`,
        );
      }
    }
  }

  /**
   * Get current blind info for a tournament room.
   */
  async getCurrentBlindInfo(roomId: string): Promise<BlindLevel | null> {
    const room = await this.roomService.findOne(roomId);
    if (!room || !room.isTournament || !room.tournamentConfig) {
      return null;
    }

    const config = room.tournamentConfig as unknown as SngConfig;
    return config.blindSchedule[config.currentBlindLevel] ?? null;
  }
}
