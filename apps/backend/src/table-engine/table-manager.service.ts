import { Injectable, Logger } from '@nestjs/common';
import { Table, TableSnapshot } from './table';
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
export class TableManagerService {
  private readonly logger = new Logger(TableManagerService.name);
  private tables: Map<string, Table> = new Map();
  // Deduplicate concurrent getTable calls for the same roomId to prevent
  // multiple Table instances being created for the same room.
  private pendingGetTable: Map<string, Promise<Table | undefined>> = new Map();

  constructor(
    private roomService: RoomService,
    private walletService: WalletService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getTable(roomId: string): Promise<Table | undefined> {
    if (this.tables.has(roomId)) {
      return this.tables.get(roomId);
    }
    if (!this.pendingGetTable.has(roomId)) {
      const promise = this.roomService.findOne(roomId).then(async (room) => {
        this.pendingGetTable.delete(roomId);
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
            ? Table.fromSnapshot(snapshot, room.maxPlayers, room.blindSmall, room.blindBig, minBuyIn, roomPassword)
            : new Table(room.id, room.id, room.maxPlayers, room.blindSmall, room.blindBig, minBuyIn, roomPassword);
          this.tables.set(roomId, table);
        }
        return this.tables.get(roomId);
      });
      this.pendingGetTable.set(roomId, promise);
    }
    return this.pendingGetTable.get(roomId);
  }

  private async loadSnapshotFromRedis(roomId: string): Promise<TableSnapshot | null> {
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

  private parseSnapshot(snapshot: string | null | undefined): TableSnapshot | null {
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
    // Remove from SQLite
    await this.prisma.table.deleteMany({
      where: { id: roomId },
    });
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
    const primaryWinner = handResult.reduce((a, b) => (b.winAmount > a.winAmount ? b : a), handResult[0]);
    const totalPot = handResult.reduce((sum, r) => sum + r.winAmount, 0);

    try {
      // Create the Hand record, then Settlement + Transaction records
      const hand = await this.prisma.hand.create({
        data: {
          tableId: roomId,
          winnerId: primaryWinner.winAmount > 0 ? primaryWinner.playerId : null,
          potSize: totalPot,
        },
      });

      const settlementData = handResult.map((r) => ({
        handId: hand.id,
        userId: r.playerId,
        amount: r.winAmount,
      }));

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

      await this.prisma.$transaction([
        this.prisma.settlement.createMany({ data: settlementData }),
        ...transactionData.map((t) => this.prisma.transaction.create({ data: t })),
      ]);
    } catch (err) {
      // Non-fatal: log and continue — game integrity (balance updates) must not be blocked
      console.error(`[persistSettlementRecords] roomId=${roomId}`, err);
    }
  }

  getTables(): Table[] {
    return Array.from(this.tables.values());
  }

  async getUserCurrentRoomId(userId: string): Promise<string | null> {
    for (const [roomId, table] of this.tables.entries()) {
      if (table.hasPlayer(userId)) {
        return roomId;
      }
    }

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
        return persistedTable.id;
      }
    }

    return null;
  }

  async leaveCurrentRoom(userId: string): Promise<{
    roomId: string;
    dissolved: boolean;
  } | null> {
    const roomId = await this.getUserCurrentRoomId(userId);
    if (!roomId) {
      return null;
    }

    const table = await this.getTable(roomId);
    if (!table) {
      return null;
    }

    const removedPlayer = table.removePlayer(userId);
    if (removedPlayer) {
      await this.walletService.setBalance(removedPlayer.id, removedPlayer.stack);
      await this.walletService.unfreezeBalance(removedPlayer.id);
    }

    const hasNoPlayers = table.getPlayerCount() === 0;
    if (!hasNoPlayers) {
      await this.persistTableState(roomId);
      await this.broadcastRoomStatus(roomId);
      return { roomId, dissolved: false };
    }

    this.tables.delete(roomId);
    await this.clearTableState(roomId);

    try {
      await this.roomService.deleteRoom(roomId);
      roomEvents.emit(ROOM_DISSOLVED_EVENT, { id: roomId });
      return { roomId, dissolved: true };
    } catch {
      return { roomId, dissolved: false };
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
