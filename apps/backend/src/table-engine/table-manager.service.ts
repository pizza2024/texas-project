import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GameStage, Table, TableSnapshot } from './table';
import { RoomService } from '../room/room.service';
import {
  ROOM_DISSOLVED_EVENT,
  ROOM_STATUS_UPDATED_EVENT,
  roomEvents,
} from '../websocket/room-events';
import { WalletService } from '../wallet/wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** Redis key for a table snapshot; TTL = 24 h */
const TABLE_KEY = (roomId: string) => `table:${roomId}`;
const TABLE_TTL = 86400;

@Injectable()
export class TableManagerService implements OnModuleInit {
  private readonly logger = new Logger(TableManagerService.name);
  private tables: Map<string, Table> = new Map();
  // Deduplicate concurrent getTable calls for the same roomId to prevent
  // multiple Table instances being created for the same room.
  private pendingGetTable: Map<string, Promise<Table | undefined>> = new Map();
  // O(1) userId → roomId lookup index, updated on join/leave/recovery.
  private userRooms = new Map<string, string>();

  constructor(
    private roomService: RoomService,
    private walletService: WalletService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cleanupOfflineResidueOnStartup();
  }

  /**
   * Startup guardrail: if a previous process exited without emitting leave/disconnect,
   * WAITING tables may still contain seated players in persisted snapshots.
   *
   * We clear those seats and release frozen chips to avoid ghost occupancy after restart.
   * Active hands are intentionally untouched so in-hand recovery remains possible.
   */
  private async cleanupOfflineResidueOnStartup(): Promise<void> {
    const persistedTables = await this.prisma.table.findMany({
      where: { stateSnapshot: { not: null } },
      select: {
        id: true,
        stateSnapshot: true,
      },
    });

    let cleanedTables = 0;
    let releasedSeats = 0;

    for (const persistedTable of persistedTables) {
      const snapshot = this.parseSnapshot(persistedTable.stateSnapshot);
      if (!snapshot || snapshot.currentStage !== GameStage.WAITING) {
        continue;
      }

      const seatedPlayers = snapshot.players.filter(
        (player): player is NonNullable<typeof player> => player !== null,
      );
      if (seatedPlayers.length === 0) {
        continue;
      }

      for (const player of seatedPlayers) {
        // Use atomic resetBalanceAndUnfreeze to prevent stale frozenChips
        // if the process crashes between setBalance and unfreezeBalance.
        await this.walletService.resetBalanceAndUnfreeze(
          player.id,
          Math.max(0, Number(player.stack) || 0),
        );
      }

      this.tables.delete(persistedTable.id);
      await this.redis.del(TABLE_KEY(persistedTable.id));
      await this.prisma.table.updateMany({
        where: { id: persistedTable.id },
        data: {
          state: GameStage.WAITING,
          stateSnapshot: null,
          snapshotUpdatedAt: new Date(),
        },
      });

      cleanedTables += 1;
      releasedSeats += seatedPlayers.length;
    }

    if (cleanedTables > 0) {
      this.logger.warn(
        `Startup cleanup cleared ${releasedSeats} stale seat(s) across ${cleanedTables} waiting table(s).`,
      );
    }
  }

  async getTable(roomId: string): Promise<Table | undefined> {
    if (this.tables.has(roomId)) {
      return this.tables.get(roomId);
    }
    if (!this.pendingGetTable.has(roomId)) {
      const promise = this.roomService
        .findOne(roomId)
        .then(async (room) => {
          if (room && !this.tables.has(roomId)) {
            // Priority: Redis (fast) → SQLite (durable) → fresh table
            let snapshot = await this.loadSnapshotFromRedis(roomId);
            if (!snapshot) {
              const persistedTable = await this.prisma.table.findUnique({
                where: { id: roomId },
                select: { stateSnapshot: true },
              });
              snapshot = this.parseSnapshot(persistedTable?.stateSnapshot);
              if (snapshot) {
                this.logger.debug(`table:${roomId} recovered from SQLite`);
              }
            } else {
              this.logger.debug(`table:${roomId} recovered from Redis`);
            }

            const minBuyIn = room.minBuyIn > 0 ? room.minBuyIn : room.blindBig;
            const roomPassword = room.password ?? null;
            const table = snapshot
              ? Table.fromSnapshot(
                  snapshot,
                  room.maxPlayers,
                  room.blindSmall,
                  room.blindBig,
                  minBuyIn,
                  roomPassword,
                )
              : new Table(
                  room.id,
                  room.id,
                  room.maxPlayers,
                  room.blindSmall,
                  room.blindBig,
                  minBuyIn,
                  roomPassword,
                );
            // Set tier from room for tier-based rake
            table.tier = room.tier ?? 'LOW';
            this.tables.set(roomId, table);

            // Populate userRooms index from recovered players (handles server restart).
            for (const player of table.players) {
              if (player) this.userRooms.set(player.id, roomId);
            }
          }
          return this.tables.get(roomId);
        })
        .finally(() => {
          // Always clean up pending entry, regardless of resolve or reject,
          // to prevent memory leaks when roomService.findOne() rejects.
          this.pendingGetTable.delete(roomId);
        });
      this.pendingGetTable.set(roomId, promise);
    }
    return this.pendingGetTable.get(roomId);
  }

  private async loadSnapshotFromRedis(
    roomId: string,
  ): Promise<TableSnapshot | null> {
    const raw = await this.redis.get(TABLE_KEY(roomId));
    return this.parseSnapshot(raw);
  }

  async getUserBalance(userId: string): Promise<number> {
    return this.walletService.getBalance(userId);
  }

  async getUserAvailableBalance(userId: string): Promise<number> {
    return this.walletService.getAvailableBalance(userId);
  }

  async freezePlayerBalance(userId: string, amount: number): Promise<void> {
    await this.walletService.freezeBalance(userId, amount);
  }

  private parseSnapshot(
    snapshot: string | null | undefined,
  ): TableSnapshot | null {
    if (!snapshot) {
      return null;
    }

    try {
      return JSON.parse(snapshot) as TableSnapshot;
    } catch {
      return null;
    }
  }

  async persistTableState(roomId: string): Promise<void> {
    const table = this.tables.get(roomId);
    if (!table) {
      return;
    }

    const snapshot = JSON.stringify(table.toSnapshot());

    // Write to Redis first (fast, crash-safe buffer)
    await this.redis.set(TABLE_KEY(roomId), snapshot, TABLE_TTL);

    // Write to SQLite (durable persistence)
    await this.prisma.table.upsert({
      where: { id: roomId },
      update: {
        state: table.currentStage,
        stateSnapshot: snapshot,
        snapshotUpdatedAt: new Date(),
      },
      create: {
        id: roomId,
        roomId,
        state: table.currentStage,
        stateSnapshot: snapshot,
        snapshotUpdatedAt: new Date(),
      },
    });
  }

  async clearTableState(roomId: string): Promise<void> {
    // Remove from Redis
    await this.redis.del(TABLE_KEY(roomId));
    // Remove from SQLite; if the table has associated hand records Prisma's
    // client-side referential integrity will reject the delete (P2003).
    // In that case, at minimum nullify the snapshot so getUserCurrentRoom
    // will no longer find any player in this table.
    try {
      await this.prisma.table.deleteMany({
        where: { id: roomId },
      });
    } catch {
      await this.prisma.table
        .updateMany({
          where: { id: roomId },
          data: { stateSnapshot: null },
        })
        .catch((e) =>
          this.logger.warn(
            `clearTableState: fallback nullify failed for room ${roomId}: ${e}`,
          ),
        );
    }
  }

  async persistTableBalances(roomId: string): Promise<void> {
    const table = this.tables.get(roomId);
    if (!table) {
      return;
    }

    // frozen=true: player is still seated, so keep their entire balance frozen
    await this.walletService.setBalances(table.getPersistentBalances(), true);
  }

  /**
   * Record Settlement + Transaction rows for the just-completed hand.
   * Must be called BEFORE resetToWaiting() so lastHandResult is still populated.
   */
  async persistSettlementRecords(roomId: string): Promise<void> {
    const table = this.tables.get(roomId);
    if (!table?.lastHandResult || table.lastHandResult.length === 0) {
      return;
    }

    const handResult = table.lastHandResult;

    // Determine primary winner (largest win amount) for Hand.winnerId
    const primaryWinner = handResult.reduce(
      (a, b) => (b.winAmount > a.winAmount ? b : a),
      handResult[0],
    );
    const totalPot = handResult.reduce((sum, r) => sum + r.winAmount, 0);

    try {
      // Create the Hand record, then Settlement + Transaction records
      const hand = await this.prisma.hand.create({
        data: {
          tableId: roomId,
          winnerId: primaryWinner.winAmount > 0 ? primaryWinner.playerId : null,
          potSize: totalPot,
          rake: table.rakeAmount,
          rakePercent: table.rakePercent,
        },
      });

      // Calculate each winner's proportional share of the rake
      const totalWinAmount = handResult.reduce(
        (sum, r) => sum + r.winAmount,
        0,
      );

      const settlementData = handResult.map((r) => {
        // Proportional rake share = (winAmount / totalWinAmount) * totalRake
        const rakeShare =
          totalWinAmount > 0
            ? Math.floor((r.winAmount / totalWinAmount) * table.rakeAmount)
            : 0;
        return {
          handId: hand.id,
          userId: r.playerId,
          amount: r.winAmount,
          rakeAmount: rakeShare,
        };
      });

      const transactionData = handResult
        .filter((r) => r.totalBet > 0 || r.winAmount > 0)
        .map((r) => {
          const profit = r.winAmount - r.totalBet;
          return {
            userId: r.playerId,
            amount: profit,
            type: profit >= 0 ? 'GAME_WIN' : 'GAME_LOSS',
          };
        });

      // Update each winner's totalRake
      const rakeUpdates = settlementData
        .filter((s) => s.rakeAmount > 0)
        .map((s) =>
          this.prisma.user.update({
            where: { id: s.userId },
            data: { totalRake: { increment: s.rakeAmount } },
          }),
        );

      await this.prisma.$transaction([
        this.prisma.settlement.createMany({ data: settlementData }),
        ...transactionData.map((t) =>
          this.prisma.transaction.create({ data: t }),
        ),
        ...rakeUpdates,
      ]);
    } catch (err) {
      // Non-fatal: log and continue — game integrity (balance updates) must not be blocked
      this.logger.error(`[persistSettlementRecords] roomId=${roomId}`, err);
    }
  }

  getTables(): Table[] {
    return Array.from(this.tables.values());
  }

  async getUserCurrentRoomId(userId: string): Promise<string | null> {
    return (await this.getUserCurrentRoom(userId))?.roomId ?? null;
  }

  async getUserCurrentRoom(userId: string): Promise<{
    roomId: string;
    isMatchmaking: boolean;
    isInActiveGame: boolean;
  } | null> {
    // Fast path: O(1) in-memory index
    const roomId = this.userRooms.get(userId);
    if (roomId) {
      const table = this.tables.get(roomId);
      if (table) {
        const room = await this.roomService.findOne(roomId);
        return {
          roomId,
          isMatchmaking: room?.isMatchmaking ?? false,
          isInActiveGame: table.currentStage !== GameStage.WAITING,
        };
      }
      // Indexed roomId but Table not in memory — clean up stale index entry
      this.userRooms.delete(userId);
    }

    // Secondary fallback: scan in-memory tables directly
    // (covers cases where players were added without going through registerPlayerRoom,
    // e.g. test scenarios or recovery paths)
    for (const [roomId, table] of this.tables.entries()) {
      if (table.hasPlayer(userId)) {
        const room = await this.roomService.findOne(roomId);
        return {
          roomId,
          isMatchmaking: room?.isMatchmaking ?? false,
          isInActiveGame: table.currentStage !== GameStage.WAITING,
        };
      }
    }

    // Tertiary fallback: check persisted tables (covers server restart recovery)
    const persistedTables = await this.prisma.table.findMany({
      where: { stateSnapshot: { not: null } },
      select: {
        id: true,
        stateSnapshot: true,
      },
    });

    for (const persistedTable of persistedTables) {
      const snapshot = this.parseSnapshot(persistedTable.stateSnapshot);
      if (snapshot?.players.some((player) => player?.id === userId)) {
        const room = await this.roomService.findOne(persistedTable.id);
        return {
          roomId: persistedTable.id,
          isMatchmaking: room?.isMatchmaking ?? false,
          isInActiveGame: snapshot.currentStage !== GameStage.WAITING,
        };
      }
    }

    return null;
  }

  /** Register a player as seated in a room (called after successful join). */
  registerPlayerRoom(userId: string, roomId: string): void {
    this.userRooms.set(userId, roomId);
  }

  async leaveCurrentRoom(userId: string): Promise<{
    roomId: string;
    dissolved: boolean;
    reachedSettlement: boolean;
  } | null> {
    const roomId = await this.getUserCurrentRoomId(userId);
    if (!roomId) {
      return null;
    }

    const table = await this.getTable(roomId);
    if (!table) {
      return null;
    }

    // Fold the player if they leave during an active hand.
    const reachedSettlement = table.foldPlayerOnLeave(userId);

    const removedPlayer = table.removePlayer(userId);
    if (removedPlayer) {
      this.userRooms.delete(removedPlayer.id);
      await this.walletService.setBalance(
        removedPlayer.id,
        removedPlayer.stack,
      );
      await this.walletService.unfreezeBalance(removedPlayer.id);
    }

    const hasNoPlayers = table.getPlayerCount() === 0;
    if (!hasNoPlayers) {
      await this.persistTableState(roomId);
      await this.broadcastRoomStatus(roomId);
      return { roomId, dissolved: false, reachedSettlement };
    }

    this.tables.delete(roomId);
    await this.clearTableState(roomId);

    try {
      await this.roomService.deleteRoom(roomId);
      roomEvents.emit(ROOM_DISSOLVED_EVENT, { id: roomId });
      return { roomId, dissolved: true, reachedSettlement: false };
    } catch {
      return { roomId, dissolved: false, reachedSettlement: false };
    }
  }

  async getRoomStatus(roomId: string): Promise<{
    roomId: string;
    currentPlayers: number;
    maxPlayers: number;
    isFull: boolean;
  } | null> {
    const room = await this.roomService.findOne(roomId);
    if (!room) {
      return null;
    }

    const table = await this.getTable(roomId);
    const currentPlayers = table ? table.getPlayerCount() : 0;
    const maxPlayers = room.maxPlayers;

    return {
      roomId,
      currentPlayers,
      maxPlayers,
      isFull: currentPlayers >= maxPlayers,
    };
  }

  async broadcastRoomStatus(roomId: string): Promise<void> {
    const status = await this.getRoomStatus(roomId);
    if (!status) {
      return;
    }

    roomEvents.emit(ROOM_STATUS_UPDATED_EVENT, status);
  }
}
