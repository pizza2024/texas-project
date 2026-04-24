import { Module, forwardRef } from '@nestjs/common';
import { ClubService } from './club.service';
import { ClubController } from './club.controller';
import { ClubGateway } from './gateway/club.gateway';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [forwardRef(() => WebsocketModule)],
  providers: [ClubService, ClubGateway],
  controllers: [ClubController],
  exports: [ClubService],
})
export class ClubModule {}
