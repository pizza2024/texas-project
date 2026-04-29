import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MissionModule } from '../mission/mission.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { DepositController } from './deposit.controller';
import { DepositService } from './deposit.service';

@Module({
  imports: [
    ScheduleModule,
    WalletModule,
    PrismaModule,
    RedisModule,
    MissionModule,
    forwardRef(() => WebsocketModule),
  ],
  controllers: [DepositController],
  providers: [DepositService],
})
export class DepositModule {}
