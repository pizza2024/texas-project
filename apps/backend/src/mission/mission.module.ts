import { Module, OnModuleInit } from '@nestjs/common';
import { MissionController } from './mission.controller';
import { MissionService } from './mission.service';
import { WalletModule } from '../wallet/wallet.module';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../admin/guards/admin.guard';
import { getJwtSecret } from '../config/jwt.config';

@Module({
  imports: [
    WalletModule,
    PrismaModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [MissionController],
  providers: [MissionService, AdminGuard],
  exports: [MissionService],
})
export class MissionModule implements OnModuleInit {
  constructor(private readonly missionService: MissionService) {}

  async onModuleInit() {
    await this.missionService.seedMissions();
  }
}
