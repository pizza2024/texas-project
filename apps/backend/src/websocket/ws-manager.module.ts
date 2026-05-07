import { Module } from '@nestjs/common';
import { WebSocketManager } from './websocket-manager';

@Module({
  providers: [WebSocketManager],
  exports: [WebSocketManager],
})
export class WsManagerModule {}
