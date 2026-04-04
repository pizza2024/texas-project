import { Module, forwardRef } from '@nestjs/common';
import { FriendService } from './friend.service';
import { FriendController } from './friend.controller';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [forwardRef(() => WebsocketModule)],
  providers: [FriendService],
  controllers: [FriendController],
  exports: [FriendService],
})
export class FriendModule {}
