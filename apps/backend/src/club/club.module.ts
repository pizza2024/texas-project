import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClubService } from './club.service';
import { ClubController } from './club.controller';
import { ClubGateway } from './gateway/club.gateway';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [forwardRef(() => WebsocketModule), JwtModule.register({})],
  providers: [ClubService, ClubGateway],
  controllers: [ClubController],
  exports: [ClubService],
})
export class ClubModule {}
