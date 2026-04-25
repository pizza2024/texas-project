import { Module } from '@nestjs/common';
import { TableManagerService } from './table-manager.service';
import { HandHistoryService } from './hand-history.service';
import { RoomModule } from '../room/room.module';
import {
  TableEngineController,
  HandController,
} from './table-engine.controller';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RakebackModule } from '../rakeback/rakeback.module';

@Module({
  imports: [RoomModule, WalletModule, PrismaModule, RakebackModule],
  providers: [TableManagerService, HandHistoryService],
  controllers: [TableEngineController, HandController],
  exports: [TableManagerService, HandHistoryService],
})
export class TableEngineModule {}
