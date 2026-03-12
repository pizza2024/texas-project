import { Injectable } from '@nestjs/common';
import { Table } from './table';
import { RoomService } from '../room/room.service';
import { ROOM_DISSOLVED_EVENT, roomEvents } from '../websocket/room-events';

@Injectable()
export class TableManagerService {
  private tables: Map<string, Table> = new Map();
  // Deduplicate concurrent getTable calls for the same roomId to prevent
  // multiple Table instances being created for the same room.
  private pendingGetTable: Map<string, Promise<Table | undefined>> = new Map();

  constructor(private roomService: RoomService) {}

  async getTable(roomId: string): Promise<Table | undefined> {
    if (this.tables.has(roomId)) {
      return this.tables.get(roomId);
    }
    if (!this.pendingGetTable.has(roomId)) {
      const promise = this.roomService.findOne(roomId).then((room) => {
        this.pendingGetTable.delete(roomId);
        if (room && !this.tables.has(roomId)) {
          const table = new Table(room.id, room.id, room.maxPlayers, room.blindSmall, room.blindBig);
          this.tables.set(roomId, table);
        }
        return this.tables.get(roomId);
      });
      this.pendingGetTable.set(roomId, promise);
    }
    return this.pendingGetTable.get(roomId);
  }

  getTables(): Table[] {
    return Array.from(this.tables.values());
  }

  getUserCurrentRoomId(userId: string): string | null {
    for (const [roomId, table] of this.tables.entries()) {
      if (table.hasPlayer(userId)) {
        return roomId;
      }
    }
    return null;
  }

  async leaveCurrentRoom(userId: string): Promise<{
    roomId: string;
    dissolved: boolean;
  } | null> {
    const roomId = this.getUserCurrentRoomId(userId);
    if (!roomId) {
      return null;
    }

    const table = this.tables.get(roomId);
    if (!table) {
      return null;
    }

    table.removePlayer(userId);

    const hasNoPlayers = table.getPlayerCount() === 0;
    if (!hasNoPlayers) {
      return { roomId, dissolved: false };
    }

    this.tables.delete(roomId);

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

    const table = this.tables.get(roomId);
    const currentPlayers = table ? table.getPlayerCount() : 0;
    const maxPlayers = room.maxPlayers;

    return {
      roomId,
      currentPlayers,
      maxPlayers,
      isFull: currentPlayers >= maxPlayers,
    };
  }
}
