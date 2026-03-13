import { Module } from '@nestjs/common';
import { TableManagerService } from './table-manager.service';
import { RoomModule } from '../room/room.module';
import { TableEngineController } from './table-engine.controller';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [RoomModule, WalletModule, PrismaModule],
  providers: [TableManagerService],
  controllers: [TableEngineController],
  exports: [TableManagerService],
})
export class TableEngineModule {}
