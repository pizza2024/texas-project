import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { BroadcastService } from './broadcast.service';
import { SystemStateService } from './system-state.service';
import { AdminUserController } from './admin-user.controller';
import { AdminRoomController } from './admin-room.controller';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminSystemController } from './admin-system.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { getJwtSecret } from '../config/jwt.config';

@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
    WebsocketModule,
  ],
  controllers: [
    AdminUserController,
    AdminRoomController,
    AdminFinanceController,
    AdminAnalyticsController,
    AdminSystemController,
  ],
  providers: [
    AdminGuard,
    AdminService,
    BroadcastService,
    SystemStateService,
    PrismaService,
  ],
  exports: [AdminService, BroadcastService],
})
export class AdminModule {}
