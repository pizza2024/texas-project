import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebSocketManager {
  private server: Server;
  private readonly logger = new Logger(WebSocketManager.name);

  setServer(server: Server) {
    this.server = server;
    this.logger.log('WebSocket server registered');
  }

  getServer(): Server | null {
    return this.server;
  }

  sendToAll<T = unknown>(event: string, data: T) {
    if (this.server) {
      this.server.emit(event, data);
    }
  }

  /**
   * 向指定用户的 所有 WebSocket 连接发送事件
   */
  emitToUser<T = unknown>(userId: string, event: string, data: T): void {
    if (!this.server) return;
    for (const [, socket] of this.server.sockets.sockets) {
      if ((socket.data.user?.sub as string | undefined) === userId) {
        socket.emit(event, data);
      }
    }
  }

  getConnectedCount(): number {
    if (!this.server) return 0;
    return this.server.sockets.sockets.size;
  }
}
