import { Module, forwardRef } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { ConnectionStateService } from './connection-state.service';
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
import { InsuranceModule } from '../insurance/insurance.module';
import { RakebackModule } from '../rakeback/rakeback.module';
import { WalletModule } from '../wallet/wallet.module';
import { SharedWsModule } from './shared-ws.module';
import { getJwtSecret } from '../config/jwt.config';

@Module({
  imports: [
    SharedWsModule,
    forwardRef(() => TableEngineModule),
    forwardRef(() => AuthModule),
    forwardRef(() => UserModule),
    forwardRef(() => FriendModule),
    forwardRef(() => ClubModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => InsuranceModule),
    forwardRef(() => RakebackModule),
    forwardRef(() => RoomModule),
    MatchmakingModule,
    BotModule,
    MissionModule,
    RedisModule,
    WalletModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  providers: [
    AppGateway,
    ConnectionStateService,
    TimerService,
  ],
  exports: [
    AppGateway,
    ConnectionStateService,
    TimerService,
    SharedWsModule,
  ],
})
export class WebsocketModule {}
