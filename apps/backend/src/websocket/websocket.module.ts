import { Module, forwardRef } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { WebSocketManager } from './websocket-manager';
import { ConnectionStateService } from './connection-state.service';
import { BroadcastService } from './broadcast.service';
import { TimerService } from './timer.service';
import { TableEngineModule } from '../table-engine/table-engine.module';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { BotModule } from '../bot/bot.module';
import { FriendModule } from '../friend/friend.module';
import { RedisModule } from '../redis/redis.module';
import { ClubModule } from '../club/club.module';
import { RoomModule } from '../room/room.module';
import { MissionModule } from '../mission/mission.module';
import { NotificationModule } from '../notification/notification.module';
import { getJwtSecret } from '../config/jwt.config';

@Module({
  imports: [
    TableEngineModule,
    AuthModule,
    UserModule,
    MatchmakingModule,
    BotModule,
    forwardRef(() => FriendModule),
    forwardRef(() => ClubModule),
    RoomModule,
    MissionModule,
    forwardRef(() => NotificationModule),
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  providers: [
    AppGateway,
    WebSocketManager,
    ConnectionStateService,
    BroadcastService,
    TimerService,
  ],
  exports: [
    AppGateway,
    WebSocketManager,
    ConnectionStateService,
    BroadcastService,
    TimerService,
  ],
})
export class WebsocketModule {}
