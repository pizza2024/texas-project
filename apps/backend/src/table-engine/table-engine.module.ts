import { Module } from '@nestjs/common';
import { TableManagerService } from './table-manager.service';
import { RoomModule } from '../room/room.module';
import { TableEngineController } from './table-engine.controller';

@Module({
  imports: [RoomModule],
  providers: [TableManagerService],
  controllers: [TableEngineController],
  exports: [TableManagerService],
})
export class TableEngineModule {}
