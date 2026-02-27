import { Module } from '@nestjs/common';
import { TableManagerService } from './table-manager.service';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [RoomModule],
  providers: [TableManagerService],
  exports: [TableManagerService],
})
export class TableEngineModule {}
