import { Module } from '@nestjs/common';
import { WithdrawQueueService } from './withdraw-queue.service';

@Module({
  providers: [WithdrawQueueService],
  exports: [WithdrawQueueService],
})
export class QueueModule {}
