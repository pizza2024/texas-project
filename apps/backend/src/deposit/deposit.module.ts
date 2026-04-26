import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MissionModule } from '../mission/mission.module';
import { DepositController } from './deposit.controller';
import { DepositService } from './deposit.service';

@Module({
  imports: [
    ScheduleModule,
    WalletModule,
    PrismaModule,
    RedisModule,
    MissionModule,
  ],
  controllers: [DepositController],
  providers: [DepositService],
})
export class DepositModule {}
