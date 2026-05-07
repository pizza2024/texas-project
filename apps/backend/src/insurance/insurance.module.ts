import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InsuranceService } from './insurance.service';
import { InsuranceController } from './insurance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { getJwtSecret } from '../config/jwt.config';

@Module({
  imports: [
    PrismaModule,
    WalletModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
