import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

export interface WithdrawJobData {
  requestId: string;
  attemptNumber: number;
}

export const WITHDRAW_QUEUE_NAME = 'withdraw-chain';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_SECONDS = 30;

@Injectable()
export class WithdrawQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(WithdrawQueueService.name);
  private readonly queue: Queue<WithdrawJobData>;
  private readonly worker: Worker<WithdrawJobData>;
  private readonly connection: Redis;

  constructor() {
    this.connection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.queue = new Queue<WithdrawJobData>(WITHDRAW_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: MAX_ATTEMPTS,
        backoff: {
          type: 'fixed' as const,
          delay: RETRY_DELAY_SECONDS * 1000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });

    // Worker is created but processing is handled by WithdrawService
    // This allows the queue to manage retries automatically
    this.worker = new Worker<WithdrawJobData>(
      WITHDRAW_QUEUE_NAME,
      async (job: Job<WithdrawJobData>) => {
        this.logger.debug(
          `Queue received job for requestId=${job.data.requestId}, attempt=${job.attemptsMade + 1}`,
        );
        // Job processing is delegated back to WithdrawService
        // This worker just handles the queue mechanics
        return { requestId: job.data.requestId, attempt: job.attemptsMade + 1 };
      },
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job: Job<WithdrawJobData> | undefined, err: Error) => {
      if (job) {
        const jobId = job.id ?? 'unknown';
        const requestId = job.data?.requestId ?? 'unknown';
        const attempts = job.attemptsMade;
        this.logger.error(
          `Job ${jobId} failed for requestId=${requestId} after ${attempts} attempts: ${err.message}`,
        );
      } else {
        this.logger.error(`Job failed with error: ${err.message}`);
      }
    });

    this.logger.log(
      `WithdrawQueue initialized: maxAttempts=${MAX_ATTEMPTS}, retryDelay=${RETRY_DELAY_SECONDS}s`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    await this.connection.quit();
  }

  /**
   * Add a withdraw request to the retry queue.
   * BullMQ will automatically retry according to defaultJobOptions.
   */
  async enqueueWithdraw(requestId: string): Promise<void> {
    await this.queue.add(
      'chain-withdraw',
      { requestId, attemptNumber: 1 },
      {
        jobId: `withdraw-${requestId}`, // Ensures one job per request
        removeOnComplete: false, // Keep for debugging
      },
    );
    this.logger.log(`Withdraw ${requestId} added to retry queue`);
  }

  /**
   * Check if a request is currently in the queue.
   */
  async isInQueue(requestId: string): Promise<boolean> {
    const job = await this.queue.getJob(`withdraw-${requestId}`);
    return job != null && !(await job.isCompleted());
  }

  /**
   * Get queue stats for monitoring.
   */
  async getStats(): Promise<{ waiting: number; active: number; failed: number }> {
    const [waiting, active, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, active, failed };
  }
}
