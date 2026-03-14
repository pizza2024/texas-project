import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminUserController } from './admin-user.controller';
import { AdminRoomController } from './admin-room.controller';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminSystemController } from './admin-system.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'texas-holdem-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [
    AdminUserController,
    AdminRoomController,
    AdminFinanceController,
    AdminAnalyticsController,
    AdminSystemController,
  ],
  providers: [AdminGuard, AdminService, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}
