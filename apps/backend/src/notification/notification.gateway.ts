import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationService } from './notification.service';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: '*', credentials: true },
})
export class NotificationGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('NotificationGateway');

  constructor(
    private readonly notificationService: NotificationService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.userId;
      // Join the user's personal room so emitToUser() can reach this client
      await client.join(`user:${payload.userId}`);
    } catch {
      client.disconnect(true);
    }
  }

  /**
   * Client → Server: mark notifications as read
   * Payload: { notificationIds: string[] }
   */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { notificationIds: string[] },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    await this.notificationService.markRead(payload.notificationIds, userId);
    client.emit('mark_read', { marked: payload.notificationIds });
  }

  /**
   * Client → Server: mark all notifications as read
   * Payload: {}
   */
  @SubscribeMessage('mark_all_read')
  async handleMarkAllRead(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    const count = await this.notificationService.markAllRead(userId);
    client.emit('mark_all_read', { markedCount: count });
  }

  /**
   * Server → Client: push a notification to a specific user.
   * Called by NotificationService after creating a notification.
   * Respects DND settings — skips emit if push is not allowed.
   */
  async emitToUser(userId: string, notification: unknown) {
    const isAllowed = await this.notificationService.isPushAllowed(userId);
    if (!isAllowed) {
      this.logger.debug(`Push suppressed for user ${userId} (DND active)`);
      return;
    }
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
