import { Module } from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { BlastService } from './blast.service';
import { TournamentController } from './tournament.controller';
import { RoomModule } from '../room/room.module';
import { WalletModule } from '../wallet/wallet.module';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TableEngineModule } from '../table-engine/table-engine.module';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { SharedWsModule } from '../websocket/shared-ws.module';

@Module({
  imports: [
    RoomModule,
    WalletModule,
    RedisModule,
    PrismaModule,
    TableEngineModule,
    BroadcastModule,
    SharedWsModule,
  ],
  providers: [TournamentService, BlastService],
  controllers: [TournamentController],
  exports: [TournamentService, BlastService],
})
export class TournamentModule {}
