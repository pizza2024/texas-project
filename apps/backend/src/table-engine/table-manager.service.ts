import { Injectable } from '@nestjs/common';
import { Table, TableSnapshot } from './table';
import { RoomService } from '../room/room.service';
import {
  ROOM_DISSOLVED_EVENT,
  ROOM_STATUS_UPDATED_EVENT,
  roomEvents,
} from '../websocket/room-events';
import { WalletService } from '../wallet/wallet.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TableManagerService {
  private tables: Map<string, Table> = new Map();
  // Deduplicate concurrent getTable calls for the same roomId to prevent
  // multiple Table instances being created for the same room.
  private pendingGetTable: Map<string, Promise<Table | undefined>> = new Map();

  constructor(
    private roomService: RoomService,
    private walletService: WalletService,
    private prisma: PrismaService,
  ) {}

  async getTable(roomId: string): Promise<Table | undefined> {
    if (this.tables.has(roomId)) {
      return this.tables.get(roomId);
    }
    if (!this.pendingGetTable.has(roomId)) {
      const promise = this.roomService.findOne(roomId).then(async (room) => {
        this.pendingGetTable.delete(roomId);
        if (room && !this.tables.has(roomId)) {
          const persistedTable = await this.prisma.table.findUnique({
            where: { id: roomId },
            select: { stateSnapshot: true },
          });
          const snapshot = this.parseSnapshot(persistedTable?.stateSnapshot);
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

  async getUserBalance(userId: string): Promise<number> {
    return this.walletService.getBalance(userId);
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

    await this.prisma.table.upsert({
      where: { id: roomId },
      update: {
        state: table.currentStage,
        stateSnapshot: JSON.stringify(table.toSnapshot()),
        snapshotUpdatedAt: new Date(),
      },
      create: {
        id: roomId,
        roomId,
        state: table.currentStage,
        stateSnapshot: JSON.stringify(table.toSnapshot()),
        snapshotUpdatedAt: new Date(),
      },
    });
  }

  async clearTableState(roomId: string): Promise<void> {
    await this.prisma.table.deleteMany({
      where: { id: roomId },
    });
  }

  async persistTableBalances(roomId: string): Promise<void> {
    const table = this.tables.get(roomId);
    if (!table) {
      return;
    }

    await this.walletService.setBalances(table.getPersistentBalances());
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
