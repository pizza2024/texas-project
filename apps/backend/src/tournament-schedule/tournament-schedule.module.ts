import { Module } from '@nestjs/common';
import { TournamentScheduleController } from './tournament-schedule.controller';
import { TournamentScheduleService } from './tournament-schedule.service';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RoomModule } from '../room/room.module';
import { TournamentModule } from '../tournament/tournament.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from '../config/jwt.config';
import { AdminGuard } from '../admin/guards/admin.guard';

@Module({
  imports: [
    RedisModule,
    PrismaModule,
    RoomModule,
    TournamentModule,
    WebsocketModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [TournamentScheduleController],
  providers: [TournamentScheduleService, AdminGuard],
  exports: [TournamentScheduleService],
})
export class TournamentScheduleModule {}
