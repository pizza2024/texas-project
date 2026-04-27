import {
  Injectable,
  Logger,
  OnModuleDestroy,
  forwardRef,
  Inject,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { RoomService } from '../room/room.service';
import { TournamentService } from './tournament.service';
import { WebSocketManager } from '../websocket/websocket-manager';
import { Prisma } from '@prisma/client';
import {
  BLAST_MAX_PLAYERS,
  BLAST_INITIAL_CHIPS,
  BLAST_PRIZE_DISTRIBUTION,
  BLAST_LOBBY_KEY_PREFIX,
  BLAST_LOBBY_QUEUE_KEY,
  BlastLobby,
  BlastConfig,
  TournamentType,
  createBlastBlindSchedule,
} from '@texas/shared/types/tournament';
import { TableManagerService } from '../table-engine/table-manager.service';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Blast total game duration: 3 minutes in milliseconds */
export const BLAST_TOTAL_DURATION_MS = 180_000;

/**
 * Blast prize distribution in basis points (bp).
 * 7000 bp = 70%, 2000 bp = 20%, 1000 bp = 10%
 * Using basis points avoids floating-point errors in distribution.
 */
export const BLAST_PRIZE_BASIS_POINTS = [7000, 2000, 1000] as const;

/** Redis key prefix for active Blast games */
export const BLAST_GAME_KEY_PREFIX = 'blast:game:';

/** Maximum number of basis points (100% = 10000 bp) */
const BASIS_POINTS_TOTAL = 10_000;

// ─── Types ───────────────────────────────────────────────────────────────────

/** In-memory record of an active Blast game */
export interface BlastGameRecord {
  /** Lobby ID that spawned this game */
  lobbyId: string;
  /** Table/room ID for this game */
  tableId: string;
  /** Player IDs in this game */
  playerIds: string[];
  /** Buy-in amount per player */
  buyin: number;
  /** Multiplier drawn at game start (e.g. 2, 5, 10) */
  multiplier: number;
  /** Total prize pool = buyin × 3 × multiplier */
  totalPrizePool: number;
  /** Unix timestamp (ms) when the game started */
  startedAt: number;
  /** Unix timestamp (ms) when the game ends */
  endsAt: number;
  /** Small blind for this game */
  smallBlind: number;
  /** Big blind for this game */
  bigBlind: number;
}

@Injectable()
export class BlastService implements OnModuleDestroy {
  private readonly logger = new Logger(BlastService.name);

  /** In-memory map of active Blast games: tableId → BlastGameRecord */
  private readonly activeGames = new Map<string, BlastGameRecord>();

  /** Interval handle for the periodic TTL cleanup sweep */
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly walletService: WalletService,
    private readonly roomService: RoomService,
    @Inject(forwardRef(() => TournamentService))
    private readonly tournamentService: TournamentService,
    private readonly tableManager: TableManagerService,
    private readonly wsManager: WebSocketManager,
  ) {
    // Start periodic TTL cleanup sweep for the activeGames Map
    // P1-NEW-001: prevents memory leak from stale entries
    this.cleanupInterval = setInterval(() => {
      this.sweepExpiredGames();
    }, BLAST_TOTAL_DURATION_MS); // sweep once per full game duration
  }

  // ─── TTL Cleanup ─────────────────────────────────────────────────────────────

  /**
   * Periodically sweep the activeGames Map to remove expired entries.
   * Called automatically by the cleanup interval; also idempotent on direct call.
   *
   * P1-NEW-001 fix: stale entries could accumulate indefinitely when game-end
   * events (time_expired, one_player_left) are not fired. The sweep removes
   * any entry whose endsAt has passed.
   */
  private sweepExpiredGames(): void {
    const now = Date.now();
    let swept = 0;
    for (const [tableId, game] of this.activeGames) {
      if (now >= game.endsAt) {
        this.logger.warn(
          `sweepExpiredGames: removing stale Blast game ${tableId} ` +
            `(ended at ${game.endsAt}, now ${now}, overshoot ${now - game.endsAt}ms)`,
        );
        this.activeGames.delete(tableId);
        swept++;
      }
    }
    if (swept > 0) {
      this.logger.log(`sweepExpiredGames: removed ${swept} stale entry(ies)`);
    }
  }

  /** NestJS lifecycle hook: clean up interval on module destroy */
  async onModuleDestroy(): Promise<void> {
    clearInterval(this.cleanupInterval);
  }

  // ─── startBlastGame ─────────────────────────────────────────────────────────

  /**
   * Start a Blast game for a lobby that has 3 players.
   *
   * Flow:
   * 1. Retrieve the lobby from Redis and validate it has 3 players
   * 2. Create a Room + Table for the game (via RoomService + TableManager)
   * 3. Freeze each player's buyin chips
   * 4. Mark lobby as 'active' in Redis
   * 5. Store the BlastGameRecord in memory (and Redis for recovery)
   *
   * @param lobbyId - The lobby UUID to start the game from
   * @returns The created BlastGameRecord, or null if the lobby is invalid
   */
  async startBlastGame(lobbyId: string): Promise<BlastGameRecord | null> {
    // 1. Retrieve lobby
    const lobby = await this.getLobby(lobbyId);
    if (!lobby) {
      this.logger.warn(`startBlastGame: lobby ${lobbyId} not found`);
      return null;
    }

    // 2. Validate player count
    if (lobby.playerIds.length < BLAST_MAX_PLAYERS) {
      this.logger.warn(
        `startBlastGame: lobby ${lobbyId} has ${lobby.playerIds.length} players, need ${BLAST_MAX_PLAYERS}`,
      );
      return null;
    }

    // 3. Freeze buyin for all players and create room+table
    const buyin = lobby.buyin;
    const playerIds = lobby.playerIds;

    // Freeze buyin chips for each player
    for (const playerId of playerIds) {
      await this.walletService.freezeBalance(playerId, buyin);
    }

    // 4. Create a Room for this Blast game
    // The roomId matches the lobbyId for easy correlation
    const blindSchedule = createBlastBlindSchedule(lobby.smallBlind);
    const multiplier = this.drawMultiplier();
    const now = Date.now();
    const endsAt = now + BLAST_TOTAL_DURATION_MS;

    const blastConfig: BlastConfig = {
      type: TournamentType.BLAST,
      buyin,
      maxPlayers: BLAST_MAX_PLAYERS,
      prizeDistribution: BLAST_PRIZE_DISTRIBUTION,
      multiplier,
      startedAt: now,
      durationMs: BLAST_TOTAL_DURATION_MS,
      endsAt,
      currentBlindLevel: 0,
      blindLevelStartedAt: now,
      totalPrizePool: buyin * BLAST_MAX_PLAYERS * multiplier,
    };

    const room = await this.roomService.createRoom({
      id: lobbyId, // Use lobby ID as room ID for correlation
      name: `Blast-${lobbyId.slice(0, 8)}`,
      blindSmall: lobby.smallBlind,
      blindBig: lobby.bigBlind,
      maxPlayers: BLAST_MAX_PLAYERS,
      minBuyIn: buyin,
      isTournament: true,
      isBlast: true,
      blastConfig: blastConfig as unknown as Prisma.InputJsonValue,
    });

    // 5. Create/get the table via TableManager
    const table = await this.tableManager.getTable(lobbyId);
    if (!table) {
      this.logger.error(`startBlastGame: failed to get table for ${lobbyId}`);
      // Rollback frozen balances
      for (const playerId of playerIds) {
        await this.walletService.unfreezeBalance(playerId);
      }
      return null;
    }

    // 6. Add players to the table with initial chips
    for (const playerId of playerIds) {
      const user = await this.prisma.user.findUnique({
        where: { id: playerId },
        select: { nickname: true },
      });
      const nickname = user?.nickname ?? `Player-${playerId.slice(0, 8)}`;
      table.addPlayer({ sub: playerId, nickname }, BLAST_INITIAL_CHIPS);
      this.tableManager.registerPlayerRoom(playerId, lobbyId);
    }

    // 7. Create the Blast game record
    const gameRecord: BlastGameRecord = {
      lobbyId,
      tableId: lobbyId,
      playerIds,
      buyin,
      multiplier,
      totalPrizePool: blastConfig.totalPrizePool,
      startedAt: now,
      endsAt,
      smallBlind: lobby.smallBlind,
      bigBlind: lobby.bigBlind,
    };

    // 8. Store in memory
    this.activeGames.set(lobbyId, gameRecord);

    // 9. Persist to Redis for cross-instance recovery
    await this.persistGameRecord(gameRecord);

    // 10. Mark lobby as active in Redis
    await this.updateLobbyStatus(lobbyId, 'active');

    this.logger.log(
      `Blast game started: lobby=${lobbyId} table=${lobbyId} players=${playerIds.join(',')} ` +
        `buyin=${buyin} multiplier=${multiplier}x prizePool=${blastConfig.totalPrizePool} endsAt=${endsAt}`,
    );

    // Schedule timer to end the game when time expires
    const delayMs = Math.max(0, endsAt - Date.now());
    setTimeout(() => {
      this.endBlastGame(lobbyId).catch((err) =>
        this.logger.error(`endBlastGame timer failed for ${lobbyId}: ${err}`),
      );
    }, delayMs);

    // Emit blast_game_started to all players
    if (this.wsManager.getServer()) {
      for (const playerId of playerIds) {
        this.wsManager.emitToUser(playerId, 'blast_game_started', {
          lobbyId,
          tableId: lobbyId,
          playerIds,
          multiplier,
          totalPrizePool: blastConfig.totalPrizePool,
          endsAt,
          smallBlind: lobby.smallBlind,
          bigBlind: lobby.bigBlind,
          buyin,
          startedAt: now,
        });
      }
    }

    return gameRecord;
  }

  // ─── onBlastHandComplete ───────────────────────────────────────────────────

  /**
   * Called by the table engine after each hand completes in a Blast game.
   * Checks if the game should continue or end based on time and player count.
   *
   * @param tableId - The table/room ID
   * @param winners - Array of player IDs who won the hand (can be empty for fold-win)
   * @returns 'continue' if the game continues, 'time_expired' if time ran out,
   *          'one_player_left' if only one player remains
   */
  async onBlastHandComplete(
    tableId: string,
    winners: string[],
  ): Promise<'continue' | 'time_expired' | 'one_player_left'> {
    const game = this.activeGames.get(tableId);
    if (!game) {
      this.logger.warn(
        `onBlastHandComplete: no active game found for table ${tableId}`,
      );
      return 'continue';
    }

    // Get current table state to check player count
    const table = await this.tableManager.getTable(tableId);
    if (!table) {
      return 'continue';
    }

    const activePlayerCount = table.getPlayerCount();
    const now = Date.now();

    // Check termination conditions (priority order):
    // 1. Time expired → end game with current chip rankings
    // 2. Only 1 player left → end game with remaining as winner
    if (now >= game.endsAt) {
      this.logger.log(
        `Blast game ${tableId} ended: time expired (${now} >= ${game.endsAt})`,
      );
      await this.endBlastGame(tableId);
      return 'time_expired';
    }

    if (activePlayerCount <= 1) {
      this.logger.log(
        `Blast game ${tableId} ended: ${activePlayerCount} player(s) remaining`,
      );
      await this.endBlastGame(tableId);
      return 'one_player_left';
    }

    // Log hand result for debugging
    if (winners.length > 0) {
      this.logger.debug(
        `Blast hand complete: table=${tableId} winners=${winners.join(',')}`,
      );
    }

    return 'continue';
  }

  // ─── endBlastGame ──────────────────────────────────────────────────────────

  /**
   * End a Blast game and distribute prizes to players.
   *
   * Prize distribution uses basis points to avoid floating-point errors:
   * - 1st place: 7000 bp = 70%
   * - 2nd place: 2000 bp = 20%
   * - 3rd place: 1000 bp = 10%
   *
   * Rankings are determined by chip count at game end (higher = better).
   *
   * @param tableId - The table/room ID
   */
  async endBlastGame(tableId: string): Promise<void> {
    const game = this.activeGames.get(tableId);
    if (!game) {
      this.logger.warn(
        `endBlastGame: no active game found for table ${tableId}`,
      );
      return;
    }

    // Get final rankings from table chip counts
    const rankings =
      await this.tournamentService.calculateFinalRankings(tableId);

    if (rankings.length === 0) {
      this.logger.warn(
        `endBlastGame: no rankings found for table ${tableId}, returning frozen chips`,
      );
      // Return all frozen chips to players (no winners)
      await this.returnFrozenChips(game.playerIds, game.buyin);
      await this.cleanupGame(tableId);
      return;
    }

    // Distribute prizes using basis points
    await this.distributePrizes(game.totalPrizePool, rankings);

    this.logger.log(
      `Blast game ${tableId} ended: ` +
        rankings
          .map((r) => `place${r.place}=${r.playerId}(${r.chips})`)
          .join(' '),
    );

    // Emit blast_game_ended with final rankings to all players
    if (this.wsManager.getServer()) {
      for (const { playerId } of rankings) {
        this.wsManager.emitToUser(playerId, 'blast_game_ended', {
          tableId,
          rankings,
          totalPrizePool: game.totalPrizePool,
          multiplier: game.multiplier,
          endedAt: Date.now(),
        });
      }
    }

    await this.cleanupGame(tableId);
  }

  // ─── forfeitBlast ──────────────────────────────────────────────────────────

  /**
   * Handle a player forfeiting/leaving a Blast game mid-game.
   *
   * If the departing player was the last remaining (1 player left after removal),
   * the game ends immediately with the remaining player as winner.
   *
   * @param tableId - The table/room ID
   * @param playerId - The player who is leaving
   */
  async forfeitBlast(tableId: string, playerId: string): Promise<void> {
    const game = this.activeGames.get(tableId);
    if (!game) {
      this.logger.warn(
        `forfeitBlast: no active game found for table ${tableId}`,
      );
      return;
    }

    // Remove player from tracked list — create new array to avoid mutating
    // during iteration, then update the record for future queries
    const remainingPlayerIds = game.playerIds.filter((id) => id !== playerId);

    // Get current table state
    const table = await this.tableManager.getTable(tableId);
    if (table) {
      const remainingCount = table.getPlayerCount();

      this.logger.log(
        `Player ${playerId} forfeited from Blast game ${tableId}. ` +
          `Remaining players: ${remainingCount}`,
      );

      // If only 1 player left, end the game immediately
      if (remainingCount <= 1) {
        this.logger.log(
          `Blast game ${tableId} ending early: only ${remainingCount} player(s) left`,
        );
        await this.endBlastGame(tableId);
        return;
      }
    }

    // Update game record for tracking (so getActiveGame returns correct state)
    game.playerIds = remainingPlayerIds;

    // Otherwise, the game continues. Player has already been removed from
    // the table via leaveCurrentRoom in TableManager.
    // Emit blast_player_forfeited to remaining players
    if (this.wsManager.getServer()) {
      const remainingCount = remainingPlayerIds.length;
      for (const remainingId of remainingPlayerIds) {
        this.wsManager.emitToUser(remainingId, 'blast_player_forfeited', {
          tableId,
          playerId,
          remainingCount,
          remainingPlayerIds,
        });
      }
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Draw a random prize multiplier.
   * 60% → 2x, 30% → 5x, 10% → 10x
   *
   * NOTE: This is a simplified version. The full version (Phase 3) will use
   * drawBlastMultiplier() from @texas/shared/types/tournament which supports
   * the full multiplier range (2x–10,000x).
   */
  private drawMultiplier(): number {
    // Use crypto.getRandomValues() for cryptographic security (博彩公平性)
    // Math.random() is not cryptographically secure
    const buf = crypto.randomBytes(4);
    const roll = (buf.readUInt32BE(0) % 100) + 1; // 1-100 inclusive
    if (roll <= 60) {
      return 2; // 60% chance: 2x
    } else if (roll <= 90) {
      return 5; // 30% chance: 5x
    } else {
      return 10; // 10% chance: 10x
    }
  }

  /**
   * Retrieve a BlastLobby from Redis by ID.
   */
  private async getLobby(lobbyId: string): Promise<BlastLobby | null> {
    if (!this.redis.isAvailable) {
      return null;
    }

    const data = await this.redis.hgetall(BLAST_LOBBY_KEY_PREFIX + lobbyId);
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
   * Update the status field of a lobby in Redis.
   */
  private async updateLobbyStatus(
    lobbyId: string,
    status: 'waiting' | 'starting' | 'active',
  ): Promise<void> {
    if (!this.redis.isAvailable) return;

    const lobby = await this.getLobby(lobbyId);
    if (!lobby) return;

    lobby.status = status;

    await this.redis.hset(
      BLAST_LOBBY_KEY_PREFIX + lobbyId,
      'data',
      JSON.stringify(lobby),
    );
  }

  /**
   * Persist a BlastGameRecord to Redis for cross-instance recovery.
   * TTL is set to the remaining game duration so the record auto-expires.
   */
  private async persistGameRecord(record: BlastGameRecord): Promise<void> {
    if (!this.redis.isAvailable) return;

    const remainingMs = Math.max(0, record.endsAt - Date.now());
    if (remainingMs === 0) return; // Already expired, don't persist

    // Use redis.set with TTL (setex) for auto-expiry
    const ttlSeconds = Math.ceil(remainingMs / 1000);
    await this.redis.set(
      BLAST_GAME_KEY_PREFIX + record.tableId,
      JSON.stringify(record),
      ttlSeconds,
    );
  }

  /**
   * Distribute prizes to players based on their final rankings.
   * Uses basis points to avoid floating-point errors.
   */
  private async distributePrizes(
    totalPrizePool: number,
    rankings: Array<{ place: number; playerId: string; chips: number }>,
  ): Promise<void> {
    // P1-BLAST-009: Wrap all DB writes in a transaction for atomicity
    await this.prisma.$transaction(async (tx) => {
      for (
        let i = 0;
        i < rankings.length && i < BLAST_PRIZE_BASIS_POINTS.length;
        i++
      ) {
        const { place, playerId } = rankings[i];
        const basisPoints = BLAST_PRIZE_BASIS_POINTS[i];

        // prizeChips = totalPrizePool × (basisPoints / BASIS_POINTS_TOTAL)
        // Using integer math: (totalPrizePool * basisPoints) / BASIS_POINTS_TOTAL
        const prizeChips = Math.floor(
          (totalPrizePool * basisPoints) / BASIS_POINTS_TOTAL,
        );

        if (prizeChips > 0) {
          // Unfreeze original buyin and award prize chips
          await this.walletService.unfreezeAndAward(playerId, prizeChips);

          this.logger.log(
            `Blast prize: player=${playerId} place=${place} prize=${prizeChips} chips ` +
              `(${Math.round((basisPoints / BASIS_POINTS_TOTAL) * 100)}%)`,
          );

          // Record transaction for audit (within same transaction)
          await tx.transaction.create({
            data: {
              userId: playerId,
              amount: prizeChips,
              type: 'GAME_WIN',
            },
          });
        }
      }
    });
  }

  /**
   * Return frozen buyin chips to players when game ends without a winner
   * (e.g., no rankings found, or early termination).
   */
  private async returnFrozenChips(
    playerIds: string[],
    buyin: number,
  ): Promise<void> {
    // P1-BLAST-010: Wrap all unfreezeAndAward calls in a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const playerId of playerIds) {
        await this.walletService.unfreezeAndAward(playerId, buyin);
      }
    });
  }

  /**
   * Clean up after a game ends: remove from active games map and clear lobby.
   */
  private async cleanupGame(tableId: string): Promise<void> {
    this.activeGames.delete(tableId);

    if (this.redis.isAvailable) {
      await this.redis.del(BLAST_GAME_KEY_PREFIX + tableId).catch(() => {});
      await this.redis.lrem(BLAST_LOBBY_QUEUE_KEY, tableId).catch(() => {});
    }

    // Clear the table state via TableManager
    await this.tableManager.clearTableState(tableId);
  }

  // ─── Query methods (used by other services) ───────────────────────────────

  /**
   * Get the active Blast game record for a table, if any.
   */
  getActiveGame(tableId: string): BlastGameRecord | undefined {
    return this.activeGames.get(tableId);
  }

  /**
   * Check if a table has an active Blast game.
   */
  isBlastGame(tableId: string): boolean {
    return this.activeGames.has(tableId);
  }

  /**
   * Get all currently active Blast games.
   */
  getAllActiveGames(): BlastGameRecord[] {
    return Array.from(this.activeGames.values());
  }
}
