import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { TableManagerService } from '../table-engine/table-manager.service';
import { JwtService } from '@nestjs/jwt';
import {
  ROOM_CREATED_EVENT,
  ROOM_DISSOLVED_EVENT,
  RoomCreatedPayload,
  RoomDissolvedPayload,
  roomEvents,
} from './room-events';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AppGateway');

  constructor(
    private tableManager: TableManagerService,
    private jwtService: JwtService,
  ) {}

  private handleRoomCreated = (room: RoomCreatedPayload) => {
    this.server.emit('room_created', room);
  };

  private handleRoomDissolved = (payload: RoomDissolvedPayload) => {
    this.server.emit('room_dissolved', { id: payload.id });
  };

  onModuleInit() {
    roomEvents.on(ROOM_CREATED_EVENT, this.handleRoomCreated);
    roomEvents.on(ROOM_DISSOLVED_EVENT, this.handleRoomDissolved);
  }

  onModuleDestroy() {
    roomEvents.off(ROOM_CREATED_EVENT, this.handleRoomCreated);
    roomEvents.off(ROOM_DISSOLVED_EVENT, this.handleRoomDissolved);
  }

  /** Broadcast masked table state to every socket in the room individually. */
  private async broadcastTableState(roomId: string, table: import('../table-engine/table').Table) {
    const sockets = await this.server.in(roomId).fetchSockets();
    for (const socket of sockets) {
      const userId = socket.data.user?.sub as string | undefined;
      socket.emit('room_update', userId ? table.getMaskedView(userId) : table.getMaskedView(''));
    }
  }

  afterInit(server: Server) {
    this.logger.log('Init');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      const token = client.handshake.query.token as string;
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      this.logger.log(
        `Client connected: ${client.id} User: ${payload.username}`,
      );
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const { roomId } = data;
    const userId = client.data.user?.sub as string;

    const currentRoomId = this.tableManager.getUserCurrentRoomId(userId);
    if (currentRoomId && currentRoomId !== roomId) {
      client.emit('already_in_room', { roomId: currentRoomId });
      return {
        event: 'already_in_room',
        data: { roomId: currentRoomId },
      };
    }

    const table = await this.tableManager.getTable(roomId);
    if (!table) {
      return { event: 'error', data: 'Room not found' };
    }

    client.join(roomId);

    // Avoid duplicate seat in same room; reject if room is full
    const joined = table.addPlayer(client.data.user);
    if (!joined) {
      client.leave(roomId);
      client.emit('room_full', { roomId });
      return {
        event: 'room_full',
        data: { roomId },
      };
    }

    await this.broadcastTableState(roomId, table);
    return { event: 'joined', data: table.getMaskedView(client.data.user?.sub) };
  }

  @SubscribeMessage('player_ready')
  async handlePlayerReady(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.sub as string;
    const roomId = this.tableManager.getUserCurrentRoomId(userId);
    if (!roomId) {
      return { event: 'error', data: 'Not in any room' };
    }

    const table = await this.tableManager.getTable(roomId);
    if (!table) {
      return { event: 'error', data: 'Room not found' };
    }

    table.setPlayerReady(userId);
    await this.broadcastTableState(roomId, table);
    return { event: 'ready_updated', data: { roomId } };
  }

  @SubscribeMessage('player_action')
  async handlePlayerAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { action: string; amount?: number; roomId: string },
  ) {
    // Process action
    const table = await this.tableManager.getTable(data.roomId);
    if (table) {
      table.processAction(client.data.user.sub, data.action, data.amount || 0);
      await this.broadcastTableState(data.roomId, table);
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.sub as string;
    const result = await this.tableManager.leaveCurrentRoom(userId);

    if (!result) {
      return { event: 'error', data: 'Not in any room' };
    }

    const roomId = result.roomId;

    client.leave(roomId);
    if (!result.dissolved) {
      const table = await this.tableManager.getTable(roomId);
      if (table) {
        await this.broadcastTableState(roomId, table);
      }
    }

    return {
      event: 'left_room',
      data: { roomId, dissolved: result.dissolved },
    };
  }
}
