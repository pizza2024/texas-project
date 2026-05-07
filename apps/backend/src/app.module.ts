import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { WalletModule } from './wallet/wallet.module';
import { RoomModule } from './room/room.module';
import { TableEngineModule } from './table-engine/table-engine.module';
import { WebsocketModule } from './websocket/websocket.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { RedisModule } from './redis/redis.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { DepositModule } from './deposit/deposit.module';
import { MissionModule } from './mission/mission.module';
import { WithdrawModule } from './withdraw/withdraw.module';
import { HealthController } from './health/health.controller';
import { BotModule } from './bot/bot.module';
import { FriendModule } from './friend/friend.module';
import { ClubModule } from './club/club.module';
import { RakebackModule } from './rakeback/rakeback.module';
import { NotificationModule } from './notification/notification.module';
import { InsuranceModule } from './insurance/insurance.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { SharedWsModule } from './websocket/shared-ws.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RedisModule,
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UserModule),
    WalletModule,
    RoomModule,
    forwardRef(() => TableEngineModule),
    forwardRef(() => DepositModule),
    forwardRef(() => WebsocketModule),
    AdminModule,
    MatchmakingModule,
    MissionModule,
    WithdrawModule,
    BotModule,
    forwardRef(() => FriendModule),
    forwardRef(() => ClubModule),
    RakebackModule,
    forwardRef(() => NotificationModule),
    InsuranceModule,
    BroadcastModule,
    SharedWsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
