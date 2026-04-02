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

  sendToAll(event: string, data: any) {
    if (this.server) {
      this.server.emit(event, data);
    }
  }

  getConnectedCount(): number {
    if (!this.server) return 0;
    return this.server.sockets.sockets.size;
  }
}
