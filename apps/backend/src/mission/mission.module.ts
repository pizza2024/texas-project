import { Module, OnModuleInit } from '@nestjs/common';
import { MissionController } from './mission.controller';
import { MissionService } from './mission.service';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [WalletModule, PrismaModule],
  controllers: [MissionController],
  providers: [MissionService],
  exports: [MissionService],
})
export class MissionModule implements OnModuleInit {
  constructor(private readonly missionService: MissionService) {}

  async onModuleInit() {
    await this.missionService.seedMissions();
  }
}
