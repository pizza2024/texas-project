import { Injectable } from '@nestjs/common';
import { Table } from './table';
import { RoomService } from '../room/room.service';

@Injectable()
export class TableManagerService {
  private tables: Map<string, Table> = new Map();

  constructor(private roomService: RoomService) {}

  async getTable(roomId: string): Promise<Table | undefined> {
    if (!this.tables.has(roomId)) {
      const room = await this.roomService.findOne(roomId);
      if (room) {
        const table = new Table(room.id, room.id, room.maxPlayers, room.blindSmall, room.blindBig);
        this.tables.set(roomId, table);
      }
    }
    return this.tables.get(roomId);
  }

  getTables(): Table[] {
    return Array.from(this.tables.values());
  }
}
