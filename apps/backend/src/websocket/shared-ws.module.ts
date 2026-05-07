import { Module, forwardRef } from '@nestjs/common';
import { WebSocketManager } from './websocket-manager';
import { BroadcastService } from '../broadcast/broadcast.service';

@Module({
  providers: [WebSocketManager, BroadcastService],
  exports: [WebSocketManager, BroadcastService],
})
export class SharedWsModule {}
