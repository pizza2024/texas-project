import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Table } from '../table-engine/table';

/**
 * BroadcastService extracts table-state broadcasting logic from AppGateway.
 * It maintains no timers or locks — purely stateless emit helpers.
 */
@Injectable()
export class BroadcastService {
  readonly logger = new Logger(BroadcastService.name);

  /**
   * Broadcast masked table state to every socket in the room individually.
   * Optimized: group sockets by userId so getMaskedView() is only called once per user.
   * This matters when one user has multiple open sockets (multi-device).
   */
  async broadcastTableState(
    server: Server,
    roomId: string,
    table: Table,
  ): Promise<void> {
    // O(1) lookup of room socket IDs via adapter.rooms Map, then direct
    // socket Map access — avoids O(n) fetchSockets() over all server sockets.
    // Falls back to in().fetchSockets() for environments where adapter.rooms
    // is not populated (e.g. some test mocks).
    const adapterRooms = (server.sockets.adapter as any)?.rooms;

    let socketList: Socket<any>[];

    if (adapterRooms) {
      const roomSocketIds = adapterRooms.get(roomId);
      if (!roomSocketIds || roomSocketIds.size === 0) return;
      socketList = [];
      for (const socketId of roomSocketIds) {
        const socket = server.sockets.sockets.get(socketId);
        if (socket) socketList.push(socket);
      }
    } else {
      // Fallback: use in().fetchSockets() (works with simple test mocks)
      socketList = (await server
        .in(roomId)
        .fetchSockets()) as unknown as Socket<any>[];
    }

    // Group sockets by userId so we compute masked view once per user
    const socketsByUser = new Map<string | undefined, Socket[]>();
    for (const socket of socketList) {
      const userId = socket.data.user?.sub as string | undefined;
      const list = socketsByUser.get(userId) ?? [];
      list.push(socket);
      socketsByUser.set(userId, list);
    }

    for (const [userId, userSockets] of Array.from(socketsByUser.entries())) {
      const view = userId
        ? table.getMaskedView(userId)
        : table.getMaskedView('');
      for (const socket of userSockets) {
        socket.emit('room_update', view);
      }
    }
  }
}
