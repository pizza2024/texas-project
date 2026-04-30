import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { RoomService } from '../room/room.service';
import { BroadcastService } from '../websocket/broadcast.service';
import { WebSocketManager } from '../websocket/websocket-manager';
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
  BlastConfig,
  BLAST_MAX_PLAYERS,
  BLAST_BLIND_DURATION_SECONDS,
  BLAST_PRIZE_DISTRIBUTION,
  BLAST_INITIAL_CHIPS,
  BLAST_DEFAULT_DURATION_SECONDS,
  createBlastBlindSchedule,
  drawBlastMultiplier,
  BlastLobby,
  BLAST_LOBBY_QUEUE_KEY,
  BLAST_LOBBY_KEY_PREFIX,
} from '@texas/shared/types/tournament';

/** Redis key for tournament blind timer sorted set */
const TOURNAMENT_TIMERS_KEY = 'tournament:blind_timers';

const MATCHMAKING_TIMEOUT_MS = 30_000;

@Injectable()
export class TournamentService implements OnModuleDestroy {
  private readonly logger = new Logger(TournamentService.name);
  private readonly blindTimers = new Map<string, NodeJS.Timeout>();
  /** Maps lobbyId → NodeJS.Timeout for matchmaking timeouts */
  private readonly matchmakingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly walletService: WalletService,
    private readonly roomService: RoomService,
    private readonly broadcastService: BroadcastService,
    @Inject(forwardRef(() => WebSocketManager))
    private readonly wsManager: WebSocketManager,
    @Inject(forwardRef(() => TableManagerService))
    private readonly tableManager: TableManagerService,
  ) {}

  onModuleDestroy() {
    for (const timer of this.blindTimers.values()) {
      clearTimeout(timer);
    }
    this.blindTimers.clear();
    for (const timer of this.matchmakingTimers.values()) {
      clearTimeout(timer);
    }
    this.matchmakingTimers.clear();
  }

  /**
   * Start a 30-second matchmaking timeout for a lobby.
   * If the lobby doesn't fill within the timeout, the lobby is cancelled and
   * players are notified via the `matchmaking_timeout` socket event.
   */
  startMatchmakingTimeout(
    lobbyId: string,
    server: import('socket.io').Server,
  ): void {
    this.clearMatchmakingTimeout(lobbyId);

    const timer = setTimeout(() => {
      this.handleMatchmakingTimeout(lobbyId, server);
      this.matchmakingTimers.delete(lobbyId);
    }, MATCHMAKING_TIMEOUT_MS);

    this.matchmakingTimers.set(lobbyId, timer);
    this.logger.log(
      `Matchmaking timeout started for lobby ${lobbyId} (${MATCHMAKING_TIMEOUT_MS}ms)`,
    );
  }

  /**
   * Clear an existing matchmaking timeout (e.g. when lobby fills successfully).
   */
  clearMatchmakingTimeout(lobbyId: string): void {
    const existing = this.matchmakingTimers.get(lobbyId);
    if (existing) {
      clearTimeout(existing);
      this.matchmakingTimers.delete(lobbyId);
    }
  }

  /**
   * Handle matchmaking timeout — cancel the lobby and notify players.
   */
  private async handleMatchmakingTimeout(
    lobbyId: string,
    server: import('socket.io').Server,
  ): Promise<void> {
    const lobby = await this.getBlastLobby(lobbyId);
    if (!lobby) return;

    // Only process if lobby is still waiting (not already started/filled)
    if (lobby.status !== 'waiting') return;

    this.logger.log(`Matchmaking timeout for lobby ${lobbyId} — cancelling`);

    // Remove from queue
    if (this.redis.isAvailable) {
      await this.redis.lrem(BLAST_LOBBY_QUEUE_KEY, lobbyId).catch(() => {});
      await this.redis.del(BLAST_LOBBY_KEY_PREFIX + lobbyId).catch(() => {});
    }

    // Notify all players in the lobby
    for (const playerId of lobby.playerIds) {
      server.to(`user:${playerId}`).emit('matchmaking_timeout', { lobbyId });
    }

    server.to(`lobby:${lobbyId}`).emit('matchmaking_timeout', { lobbyId });
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
   * Create a Blast tournament configuration.
   * Draws a random multiplier at creation time (revealed when tournament starts).
   * Base prize pool = buyin × 3 players × multiplier.
   */
  createBlastConfig(buyin: number, smallBlind: number): BlastConfig {
    const multiplier = drawBlastMultiplier();
    const now = Date.now();
    const blindSchedule = createBlastBlindSchedule(smallBlind);

    return {
      type: TournamentType.BLAST,
      buyin,
      maxPlayers: BLAST_MAX_PLAYERS,
      prizeDistribution: BLAST_PRIZE_DISTRIBUTION,
      multiplier,
      startedAt: now,
      durationMs: BLAST_DEFAULT_DURATION_SECONDS * 1000,
      endsAt: now + BLAST_DEFAULT_DURATION_SECONDS * 1000,
      currentBlindLevel: 0,
      blindLevelStartedAt: now,
      totalPrizePool: buyin * BLAST_MAX_PLAYERS * multiplier,
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

  // ─── Blast Lobby Methods ─────────────────────────────────────────────────────

  /**
   * Create a new Blast lobby and add it to the Redis waiting queue.
   * The creator is automatically joined as the first player.
   */
  async createBlastLobby(
    buyin: number,
    creatorId: string,
    password?: string,
  ): Promise<BlastLobby> {
    const id = crypto.randomUUID();
    const now = Date.now();
    // Determine small/big blind based on buyin tiers
    const smallBlind = this.getBlastSmallBlind(buyin);
    const lobby: BlastLobby = {
      id,
      buyin,
      playerIds: [creatorId],
      maxPlayers: BLAST_MAX_PLAYERS,
      status: 'waiting',
      createdAt: now,
      creatorId,
      smallBlind,
      bigBlind: smallBlind * 2,
      password,
    };

    const key = BLAST_LOBBY_KEY_PREFIX + id;
    if (this.redis.isAvailable) {
      // Store lobby data as JSON hash
      await this.redis.hset(key, 'data', JSON.stringify(lobby));
      // Store password separately in hash if provided
      if (password !== undefined) {
        await this.redis.hset(key, 'password', password);
      }
      // Add lobby ID to the waiting queue list
      await this.redis.lpush(BLAST_LOBBY_QUEUE_KEY, id);
    }

    this.logger.log(
      `Blast lobby created: ${id} by ${creatorId} (buyin=${buyin}, smallBlind=${smallBlind})`,
    );

    // Start the 30-second matchmaking timeout
    const server = this.wsManager.getServer();
    if (server) {
      this.startMatchmakingTimeout(id, server);
    }

    return lobby;
  }

  /**
   * Return all waiting Blast lobbies from the Redis queue.
   * For each lobby ID, fetch its hash data from Redis.
   */
  async getBlastLobbies(): Promise<BlastLobby[]> {
    if (!this.redis.isAvailable) {
      return [];
    }

    const ids = await this.redis.lrange(BLAST_LOBBY_QUEUE_KEY);
    const lobbies: BlastLobby[] = [];

    for (const id of ids) {
      const data = await this.redis.hgetall(BLAST_LOBBY_KEY_PREFIX + id);
      if (data && data['data']) {
        try {
          const lobby = JSON.parse(data['data']) as BlastLobby;
          // Only include waiting lobbies
          if (lobby.status === 'waiting') {
            lobbies.push(lobby);
          }
        } catch {
          // Skip malformed entries
        }
      }
    }

    return lobbies;
  }

  /**
   * Get a specific Blast lobby by ID.
   * Returns null if not found.
   */
  async getBlastLobby(id: string): Promise<BlastLobby | null> {
    if (!this.redis.isAvailable) {
      return null;
    }

    const data = await this.redis.hgetall(BLAST_LOBBY_KEY_PREFIX + id);
    if (!data || !data['data']) {
      return null;
    }

    try {
      return JSON.parse(data['data']) as BlastLobby;
    } catch {
      return null;
    }
  }

  /**
   * Join an existing Blast lobby.
   * Validates: lobby exists, is waiting, not full, player hasn't already joined.
   * When the 3rd player joins, the lobby transitions to 'starting'.
   *
   * Returns the updated lobby, or null if the join was rejected.
   */
  async joinBlastLobby(
    lobbyId: string,
    playerId: string,
    password?: string,
  ): Promise<BlastLobby | null> {
    if (!this.redis.isAvailable) {
      this.logger.warn('Redis unavailable, cannot join Blast lobby');
      return null;
    }

    const lobby = await this.getBlastLobby(lobbyId);
    if (!lobby) {
      return null;
    }

    if (lobby.status !== 'waiting') {
      this.logger.warn(
        `Blast lobby ${lobbyId} is not waiting (status=${lobby.status})`,
      );
      return null;
    }

    if (lobby.playerIds.includes(playerId)) {
      this.logger.warn(`Player ${playerId} already in Blast lobby ${lobbyId}`);
      return null;
    }

    if (lobby.playerIds.length >= BLAST_MAX_PLAYERS) {
      this.logger.warn(`Blast lobby ${lobbyId} is full`);
      return null;
    }

    // Verify password if lobby is private
    if (lobby.password !== undefined) {
      if (password !== lobby.password) {
        this.logger.warn(
          `Player ${playerId} failed password check for Blast lobby ${lobbyId}`,
        );
        return null;
      }
    }

    // Add player
    lobby.playerIds.push(playerId);

    // If we now have 3 players, transition to 'starting'
    if (lobby.playerIds.length === BLAST_MAX_PLAYERS) {
      lobby.status = 'starting';
      // Cancel the matchmaking timeout since the lobby is now full
      this.clearMatchmakingTimeout(lobbyId);
      this.logger.log(
        `Blast lobby ${lobbyId} is full — transitioning to 'starting'`,
      );
    }

    // Persist updated lobby
    await this.redis.hset(
      BLAST_LOBBY_KEY_PREFIX + lobbyId,
      'data',
      JSON.stringify(lobby),
    );

    this.logger.log(
      `Player ${playerId} joined Blast lobby ${lobbyId} (${lobby.playerIds.length}/${BLAST_MAX_PLAYERS})`,
    );
    return lobby;
  }

  /**
   * Derive a small blind amount from the buyin tier.
   * Matches typical poker blind structure: ~1/100 to 1/200 of buyin.
   */
  private getBlastSmallBlind(buyin: number): number {
    const blindMap: Record<number, number> = {
      500: 5,
      1000: 10,
      2500: 25,
      5000: 50,
      10000: 100,
    };
    return blindMap[buyin] ?? Math.max(5, Math.floor(buyin / 100));
  }
}
