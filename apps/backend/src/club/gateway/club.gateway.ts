import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ClubService } from '../club.service';
import { SendChatMessageDto } from '../dto/send-chat-message.dto';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: '*', credentials: true },
})
export class ClubGateway {
  @WebSocketServer() server: Server;
  readonly logger: Logger = new Logger('ClubGateway');

  constructor(
    private readonly clubService: ClubService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticate a socket connection using JWT from handshake query.
   * Returns { userId, username } or null if invalid.
   */
  private authenticate(client: Socket): { userId: string; username: string } | null {
    try {
      const token = client.handshake.query.token as string;
      if (!token) return null;
      const payload = this.jwtService.verify(token);
      return { userId: payload.sub, username: payload.username };
    } catch {
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Club join/leave (room-based)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Client -> Server: join a club chat room
   * Payload: { clubId: string }
   * Server validates membership before joining the Socket.IO room.
   */
  @SubscribeMessage('club_join')
  async handleJoinClub(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { clubId: string },
  ) {
    const auth = this.authenticate(client);
    if (!auth) {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid token' });
      return;
    }

    const { clubId } = data;

    // Validate membership
    const isMember = await this.clubService.isClubMember(auth.userId, clubId);
    if (!isMember) {
      client.emit('club_error', { code: 'NOT_MEMBER', message: 'You are not a member of this club' });
      return;
    }

    // Join the Socket.IO room for this club
    const roomName = `club:${clubId}`;
    await client.join(roomName);
    this.logger.log(`User ${auth.username} joined club room ${clubId}`);

    client.emit('club_joined', { clubId });
  }

  /**
   * Client -> Server: leave a club chat room
   */
  @SubscribeMessage('club_leave')
  async handleLeaveClub(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { clubId: string },
  ) {
    const auth = this.authenticate(client);
    if (!auth) return;

    const roomName = `club:${data.clubId}`;
    await client.leave(roomName);
    client.emit('club_left', { clubId: data.clubId });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Chat messages (WebSocket)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Client -> Server: send a chat message to a club via WebSocket
   * Payload: { clubId: string, message: string }
   * The message is saved to DB and broadcast to all members in the room.
   */
  @SubscribeMessage('club_chat')
  async handleClubChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { clubId: string; message: string },
  ) {
    const auth = this.authenticate(client);
    if (!auth) {
      client.emit('error', { code: 'UNAUTHORIZED', message: 'Invalid token' });
      return;
    }

    const dto: SendChatMessageDto = { message: data.message };
    if (!dto.message || dto.message.trim().length === 0) {
      client.emit('club_error', { code: 'INVALID_MESSAGE', message: 'Message cannot be empty' });
      return;
    }

    if (dto.message.length > 500) {
      client.emit('club_error', { code: 'MESSAGE_TOO_LONG', message: 'Message exceeds 500 characters' });
      return;
    }

    try {
      const chat = await this.clubService.sendMessage(
        auth.userId,
        data.clubId,
        dto.message,
      );

      // Broadcast to all members in the club room (already handled in clubService,
      // but we also emit to the sender's room explicitly)
      this.server.to(`club:${data.clubId}`).emit('club_chat_message', {
        clubId: data.clubId,
        chatId: chat.id,
        userId: auth.userId,
        nickname: (chat as any).user?.nickname ?? '',
        message: chat.message,
        createdAt: chat.createdAt,
      });
    } catch (err: any) {
      const code = err?.response?.statusCode === 403 ? 'FORBIDDEN' : 'ERROR';
      client.emit('club_error', { code, message: err.message });
    }
  }
}
