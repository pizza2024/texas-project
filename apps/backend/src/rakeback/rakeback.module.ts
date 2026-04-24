import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RakebackService } from './rakeback.service';
import { RakebackController } from './rakeback.controller';

@Module({
  imports: [PrismaModule],
  providers: [RakebackService],
  controllers: [RakebackController],
  exports: [RakebackService],
})
export class RakebackModule {}
