import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DepositController } from './deposit.controller';
import { DepositService } from './deposit.service';

@Module({
  imports: [ScheduleModule, WalletModule, PrismaModule],
  controllers: [DepositController],
  providers: [DepositService],
})
export class DepositModule {}
