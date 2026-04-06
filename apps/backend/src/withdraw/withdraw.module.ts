import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { QueueModule } from '../queue/queue.module';
import {
  WithdrawController,
  AdminWithdrawController,
} from './withdraw.controller';
import { WithdrawService } from './withdraw.service';

@Module({
  imports: [
    ScheduleModule,
    WalletModule,
    PrismaModule,
    NotificationModule,
    QueueModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'texas-holdem-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [WithdrawController, AdminWithdrawController],
  providers: [WithdrawService],
  exports: [WithdrawService],
})
export class WithdrawModule {}
