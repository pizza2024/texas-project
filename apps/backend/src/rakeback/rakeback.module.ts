import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RakebackService } from './rakeback.service';

@Module({
  imports: [PrismaModule],
  providers: [RakebackService],
  exports: [RakebackService],
})
export class RakebackModule {}
