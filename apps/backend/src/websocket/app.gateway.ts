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
import { Logger, UseGuards } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { TableManagerService } from '../table-engine/table-manager.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AppGateway');

  constructor(
    private tableManager: TableManagerService,
    private jwtService: JwtService,
  ) {}

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
      this.logger.log(`Client connected: ${client.id} User: ${payload.username}`);
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
    const table = await this.tableManager.getTable(roomId);
    if (!table) {
      return { event: 'error', data: 'Room not found' };
    }

    client.join(roomId);
    
    // Add player to table logic (simplified)
    table.addPlayer(client.data.user);
    
    this.server.to(roomId).emit('room_update', table);
    return { event: 'joined', data: table };
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
      this.server.to(data.roomId).emit('room_update', table);
    }
  }
}
