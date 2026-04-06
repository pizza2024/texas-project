import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { RateLimitGuard } from '../auth/rate-limit.guard';

@Module({
  providers: [RoomService, RateLimitGuard],
  controllers: [RoomController],
  exports: [RoomService],
})
export class RoomModule {}
