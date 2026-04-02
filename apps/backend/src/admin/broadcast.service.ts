import { Injectable, Logger } from '@nestjs/common';
import { WebSocketManager } from '../websocket/websocket-manager';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger('BroadcastService');

  constructor(private wsManager: WebSocketManager) {}

  sendSystemMessage(
    message: string,
    type: 'info' | 'warning' | 'error' = 'info',
  ) {
    this.wsManager.sendToAll('system_broadcast', {
      message,
      type,
      timestamp: Date.now(),
    });
    this.logger.log(`System broadcast sent: ${message}`);
  }

  getConnectedCount(): number {
    return this.wsManager.getConnectedCount();
  }
}
