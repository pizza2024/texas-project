import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ethers, HDNodeWallet, Mnemonic } from 'ethers';
import BigNumber from 'bignumber.js';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import {
  WithdrawQueueService,
  WITHDRAW_QUEUE_NAME,
} from '../queue/withdraw-queue.service';
import { CreateWithdrawDto } from './dto/create-withdraw.dto';
import { WithdrawRequest, Prisma } from '@prisma/client';

BigNumber.config({ EXPONENTIAL_AT: 1e9, DECIMAL_PLACES: 18 });

const USDT_DECIMALS = 6;
const USDT_DECIMALS_BN = new BigNumber(10).pow(USDT_DECIMALS);
const USDT_TO_CHIPS_RATE = 100;
const WITHDRAW_COOLDOWN_MS = 60_000; // 60 seconds
const WITHDRAW_COOLDOWN_KEY = (userId: string) => `withdraw_cooldown:${userId}`;
const MIN_WITHDRAW_CHIPS = 1000;

// BullMQ retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30_000; // 30 seconds between retries

const TRANSFER_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
];

export type WithdrawStatus = 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class WithdrawService {
  private readonly logger = new Logger(WithdrawService.name);
  private readonly cooldowns = new Map<string, number>(); // userId -> last withdraw timestamp (in-memory fallback)

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    private readonly withdrawQueue: WithdrawQueueService,
  ) {}

  private get usdtContractAddress(): string {
    return (
      process.env.USDT_CONTRACT_ADDRESS ??
      '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0'
    );
  }

  private getEthRpcUrl(): string {
    const url = process.env.ETH_RPC_URL;
    if (!url) throw new ForbiddenException('ETH_RPC_URL not configured');
    return url;
  }

  private getHdWalletMnemonic(): string {
    const mnemonic = process.env.HD_WALLET_MNEMONIC;
    if (!mnemonic)
      throw new ForbiddenException('HD_WALLET_MNEMONIC not configured');
    return mnemonic;
  }

  /** Compute USDT amount from chips */
  private chipsToUsdt(chips: number): number {
    return new BigNumber(chips).dividedBy(USDT_TO_CHIPS_RATE).toNumber();
  }

  /**
   * Check and consume cooldown. Uses Redis SETNX as distributed lock when available;
   * falls back to in-memory Map (single-instance dev/test only).
   *
   * Distributed flow (Redis available):
   * 1. SETNX with TTL = cooldown — if acquired, cooldown is not active
   * 2. If SETNX fails (key exists), cooldown is still active → throw
   *
   * In-memory flow (Redis unavailable — dev/test only):
   * Maintains process-local Map, which is NOT safe for multi-instance production.
   */
  private async checkAndConsumeCooldown(userId: string): Promise<void> {
    // Try distributed Redis lock first
    const lockKey = `withdraw_cooldown_lock:${userId}`;
    const ttlSeconds = Math.ceil(WITHDRAW_COOLDOWN_MS / 1000);

    const acquired = await this.redisService.setNX(
      lockKey,
      String(Date.now()),
      ttlSeconds,
    );
    if (acquired === true) {
      // Lock acquired — no active cooldown in Redis; clear any stale in-memory entry
      this.cooldowns.delete(userId);
      return;
    }
    if (acquired === false) {
      // Lock not acquired — cooldown still active in Redis
      const ttl = await this.redisService.ttl(lockKey);
      throw new BadRequestException(
        `请等待 ${Math.ceil(ttl > 0 ? ttl : 1)} 秒后再试`,
      );
    }

    // Redis unavailable — CRITICAL security issue in multi-instance deployment.
    // In-memory Map cooldowns are per-process only, allowing users to bypass
    // cooldown across different server instances. We BLOCK withdrawals entirely
    // when Redis is unavailable to enforce the cooldown globally.
    this.logger.error(
      `[SECURITY-WITHDRAW-BYPASS] CRITICAL: Redis unavailable — withdraw cooldown is bypassed in distributed deployment. ` +
        `Blocking all withdrawals until Redis is restored. ` +
        `User ${userId} attempted withdraw at ${new Date().toISOString()}`,
    );
    throw new BadRequestException('提现服务暂时不可用，请稍后再试');
  }

  /** Set cooldown timestamp after successful withdraw creation */
  private async setCooldown(userId: string): Promise<void> {
    const ttlSeconds = Math.ceil(WITHDRAW_COOLDOWN_MS / 1000);
    const acquired = await this.redisService.setNX(
      WITHDRAW_COOLDOWN_KEY(userId),
      String(Date.now()),
      ttlSeconds,
    );
    if (acquired !== true) {
      // Redis unavailable — only update in-memory fallback (dev/test only)
      this.cooldowns.set(userId, Date.now());
    }
  }

  /** Get remaining cooldown for a user */
  async getCooldownRemaining(userId: string): Promise<{
    remainingMs: number;
    canWithdraw: boolean;
  }> {
    try {
      const ttlSeconds = await this.redisService.ttl(
        WITHDRAW_COOLDOWN_KEY(userId),
      );
      if (ttlSeconds > 0) {
        return { remainingMs: ttlSeconds * 1000, canWithdraw: false };
      }
      return { remainingMs: 0, canWithdraw: true };
    } catch {
      // Redis unavailable — use in-memory fallback
    }
    const lastUsed = this.cooldowns.get(userId) ?? 0;
    const remaining = Math.max(
      0,
      WITHDRAW_COOLDOWN_MS - (Date.now() - lastUsed),
    );
    return { remainingMs: remaining, canWithdraw: remaining === 0 };
  }

  /** Get available chip balance for withdraw */
  async getAvailableBalance(userId: string): Promise<{
    availableChips: number;
    minWithdrawChips: number;
    minWithdrawUsdt: number;
    rate: number;
  }> {
    const available = await this.walletService.getAvailableBalance(userId);
    return {
      availableChips: available,
      minWithdrawChips: MIN_WITHDRAW_CHIPS,
      minWithdrawUsdt: this.chipsToUsdt(MIN_WITHDRAW_CHIPS),
      rate: USDT_TO_CHIPS_RATE,
    };
  }

  /** Create a new withdraw request */
  async createWithdraw(
    userId: string,
    dto: CreateWithdrawDto,
  ): Promise<WithdrawRequest> {
    // 1. Cooldown check
    await this.checkAndConsumeCooldown(userId);

    // 2. Balance check
    const available = await this.walletService.getAvailableBalance(userId);
    if (available < dto.amountChips) {
      throw new BadRequestException(
        `余额不足：需要 ${dto.amountChips} chips，当前可用 ${available} chips`,
      );
    }

    // 3. Minimum amount check
    if (dto.amountChips < MIN_WITHDRAW_CHIPS) {
      throw new BadRequestException(
        `最低提现 ${MIN_WITHDRAW_CHIPS} chips（${this.chipsToUsdt(MIN_WITHDRAW_CHIPS)} USDT）`,
      );
    }

    // 4. Deduct chips immediately (atomic with request creation)
    const amountUsdt = this.chipsToUsdt(dto.amountChips);

    const request = await this.prisma.$transaction(async (tx) => {
      // Deduct chips from wallet
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const newBalance = Math.max(0, wallet.chips - dto.amountChips);
      await tx.wallet.update({
        where: { userId },
        data: { chips: newBalance },
      });

      // Sync User.coinBalance
      await tx.user.update({
        where: { id: userId },
        data: { coinBalance: newBalance },
      });

      // Create withdraw request
      return tx.withdrawRequest.create({
        data: {
          userId,
          amountChips: dto.amountChips,
          amountUsdt,
          toAddress: dto.toAddress,
          status: 'PENDING',
        },
      });
    });

    // Set cooldown (outside tx — non-critical, doesn't affect financial consistency)
    await this.setCooldown(userId);

    this.logger.log(
      `Withdraw created: user=${userId}, chips=${dto.amountChips}, usdt=${amountUsdt}, to=${dto.toAddress}`,
    );

    return request;
  }

  /** Get withdraw status by ID (user can only see their own) */
  async getWithdrawStatus(
    id: string,
    userId: string,
  ): Promise<WithdrawRequest> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id },
    });

    if (!request) throw new NotFoundException('Withdraw request not found');
    if (request.userId !== userId)
      throw new ForbiddenException('Access denied');

    return request;
  }

  /** Get withdraw history for current user */
  async getWithdrawHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<WithdrawRequest>> {
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.withdrawRequest.count({ where: { userId } }),
      this.prisma.withdrawRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { data, total, page, limit };
  }

  /** Admin: List all withdraw requests */
  async listRequests(query: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
  }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, status, userId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WithdrawRequestWhereInput = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [total, data] = await Promise.all([
      this.prisma.withdrawRequest.count({ where }),
      this.prisma.withdrawRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, nickname: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { data, total, page, limit };
  }

  /** Admin: Get single request with user info */
  async getRequestById(id: string): Promise<any> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, nickname: true, avatar: true },
        },
      },
    });

    if (!request) throw new NotFoundException('Withdraw request not found');
    return request;
  }

  /** Admin: Process withdraw (approve or reject) */
  async processWithdraw(
    id: string,
    adminId: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string,
  ): Promise<WithdrawRequest> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id },
    });

    if (!request) throw new NotFoundException('Withdraw request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be processed');
    }

    if (action === 'REJECT') {
      // Wrap in transaction to prevent concurrent reject + lost update
      const updated = await this.prisma.$transaction(async (tx) => {
        const current = await tx.withdrawRequest.findUnique({ where: { id } });
        if (!current) throw new NotFoundException('Withdraw request not found');
        if (current.status !== 'PENDING') {
          throw new BadRequestException(
            'Only PENDING requests can be processed',
          );
        }

        // Refund chips to user (idempotent — uses upsert)
        const wallet = await tx.wallet.findUnique({
          where: { userId: current.userId },
        });
        const currentBalance = wallet?.chips ?? 0;
        const newBalance = currentBalance + current.amountChips;

        await tx.wallet.upsert({
          where: { userId: current.userId },
          update: { chips: newBalance },
          create: { userId: current.userId, chips: newBalance },
        });
        await tx.user.update({
          where: { id: current.userId },
          data: { coinBalance: newBalance },
        });
        await tx.transaction.create({
          data: {
            userId: current.userId,
            amount: current.amountChips,
            type: 'WITHDRAW_REFUND',
          },
        });

        const result = await tx.withdrawRequest.update({
          where: { id },
          data: {
            status: 'FAILED',
            failureReason: reason ?? 'Rejected by admin',
            processedAt: new Date(),
          },
        });

        await tx.adminLog.create({
          data: {
            adminId,
            action: 'WITHDRAW_REJECT',
            targetType: 'USER',
            targetId: current.userId,
            detail: JSON.stringify({ requestId: id, reason }),
          },
        });

        return result;
      });

      this.logger.log(`Withdraw rejected: id=${id}, reason=${reason}`);
      return updated;
    }

    // APPROVE: move to PROCESSING and trigger chain transfer
    // Use transaction to prevent race condition — re-check status inside tx
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.withdrawRequest.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Withdraw request not found');
      if (current.status !== 'PENDING') {
        throw new BadRequestException('Only PENDING requests can be processed');
      }
      return tx.withdrawRequest.update({
        where: { id },
        data: {
          status: 'PROCESSING',
          processedAt: new Date(),
        },
      });
    });

    await this.prisma.adminLog.create({
      data: {
        adminId,
        action: 'WITHDRAW_APPROVE',
        targetType: 'USER',
        targetId: request.userId,
        detail: JSON.stringify({ requestId: id }),
      },
    });

    // Add to BullMQ retry queue for chain transfer
    // BullMQ will handle retries automatically; on final failure it calls handleWithdrawFailure
    try {
      await this.withdrawQueue.enqueueWithdraw(id);
      this.logger.log(`Withdraw ${id} enqueued for chain transfer`);
    } catch (err) {
      // Queue unavailable — fall back to direct execution
      this.logger.warn(
        `Queue unavailable, falling back to direct execution: ${(err as Error).message}`,
      );
      void this.executeChainWithdrawWithRetry(id, 1).catch((e: Error) => {
        void this.handleWithdrawFailure(id, e.message);
      });
    }

    this.logger.log(`Withdraw approved and processing: id=${id}`);
    return updated;
  }

  /** Refund chips to user after reject or failure */
  private async refundChips(
    userId: string,
    amountChips: number,
    requestId: string,
    reason?: string,
  ): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    const currentBalance = wallet?.chips ?? 0;
    const newBalance = currentBalance + amountChips;

    await this.prisma.$transaction([
      this.prisma.wallet.upsert({
        where: { userId },
        update: { chips: newBalance },
        create: { userId, chips: newBalance },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { coinBalance: newBalance },
      }),
      this.prisma.transaction.create({
        data: {
          userId,
          amount: amountChips,
          type: 'WITHDRAW_REFUND',
        },
      }),
    ]);

    // Audit log for the refund (non-blocking)
    this.adminLogIfAvailable(userId, requestId, reason).catch(() => {});

    this.logger.log(
      `Withdraw refund: user=${userId}, chips=${amountChips}, requestId=${requestId}`,
    );
  }

  private async adminLogIfAvailable(
    userId: string,
    requestId: string,
    reason?: string,
  ): Promise<void> {
    try {
      await this.prisma.adminLog.create({
        data: {
          adminId: 'SYSTEM',
          action: 'WITHDRAW_REFUND',
          targetType: 'USER',
          targetId: userId,
          detail: JSON.stringify({
            requestId,
            reason: reason ?? 'Rejected by admin',
          }),
        },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to write WITHDRAW_REFUND admin log: ${(e as Error).message}`,
      );
    }
  }

  /** Execute USDT transfer on-chain */
  async executeChainWithdraw(requestId: string): Promise<string> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Withdraw request not found');

    // Idempotent: skip if already confirmed
    if (request.status === 'CONFIRMED') {
      this.logger.log(`Withdraw ${requestId} already CONFIRMED, skipping`);
      return request.txHash ?? '';
    }

    if (request.status !== 'PROCESSING') {
      throw new BadRequestException('Request must be in PROCESSING status');
    }

    const rpcUrl = this.getEthRpcUrl();
    const mnemonic = this.getHdWalletMnemonic();

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const ownerWallet = HDNodeWallet.fromMnemonic(
      Mnemonic.fromPhrase(mnemonic),
      `m/44'/60'/0'/0/0`,
    ).connect(provider);

    const contract = new ethers.Contract(
      this.usdtContractAddress,
      TRANSFER_ABI,
      ownerWallet,
    );

    // Amount in USDT smallest units (6 decimals)
    const amountInUnits = BigInt(
      new BigNumber(request.amountUsdt)
        .multipliedBy(USDT_DECIMALS_BN)
        .toFixed(0),
    );

    this.logger.log(
      `Executing chain withdraw: to=${request.toAddress}, amount=${request.amountUsdt} USDT (${amountInUnits} units)`,
    );

    let tx: ethers.ContractTransactionResponse;
    try {
      tx = (await contract.transfer(
        request.toAddress,
        amountInUnits,
      )) as ethers.ContractTransactionResponse;
    } catch (err: unknown) {
      throw new Error(`Transfer failed: ${(err as Error).message}`);
    }

    // Wait for 1 confirmation
    await tx.wait(1);

    // P1-WITHDRAW-007: wrap DB update in retry — chain tx is already mined,
    // we must update DB status. Retry with exponential backoff.
    const MAX_RETRIES = 3;
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.prisma.withdrawRequest.update({
          where: { id: requestId },
          data: {
            txHash: tx.hash,
            fromAddress: ownerWallet.address,
            status: 'CONFIRMED',
          },
        });
        break; // success
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `executeChainWithdraw DB update attempt ${attempt}/${MAX_RETRIES} failed: ${(err as Error).message}`,
        );
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }

    // If all retries exhausted, the chain tx succeeded but DB is stale — alert and rethrow
    if (lastError) {
      const message = `executeChainWithdraw DB update failed after ${MAX_RETRIES} retries: ${(lastError as Error).message}. Chain tx ${tx.hash} is confirmed but DB status may be stale.`;
      this.logger.error(message);
      throw new Error(message);
    }

    this.logger.log(
      `Withdraw confirmed on-chain: id=${requestId}, txHash=${tx.hash}`,
    );
    return tx.hash;
  }

  /** Handle chain withdrawal failure — refund chips atomically */
  async handleWithdrawFailure(
    requestId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.withdrawRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) return;
      if (request.status === 'CONFIRMED' || request.status === 'FAILED') return;

      // Update status first to prevent double-refund from concurrent calls
      await tx.withdrawRequest.update({
        where: { id: requestId },
        data: {
          status: 'FAILED',
          failureReason: reason,
        },
      });

      // Refund chips (uses upsert for idempotency)
      const wallet = await tx.wallet.findUnique({
        where: { userId: request.userId },
      });
      const currentBalance = wallet?.chips ?? 0;
      const newBalance = currentBalance + request.amountChips;

      await tx.wallet.upsert({
        where: { userId: request.userId },
        update: { chips: newBalance },
        create: { userId: request.userId, chips: newBalance },
      });
      await tx.user.update({
        where: { id: request.userId },
        data: { coinBalance: newBalance },
      });
      await tx.transaction.create({
        data: {
          userId: request.userId,
          amount: request.amountChips,
          type: 'WITHDRAW_REFUND',
        },
      });
    });

    this.logger.log(
      `Withdraw failed and refunded: id=${requestId}, reason=${reason}`,
    );
  }

  /**
   * Execute chain withdraw with retry tracking.
   * Called by queue worker or as fallback when queue is unavailable.
   * Throws on failure so BullMQ can handle retry logic.
   */
  async executeChainWithdrawWithRetry(
    requestId: string,
    attemptNumber: number,
  ): Promise<string> {
    try {
      return await this.executeChainWithdraw(requestId);
    } catch (err) {
      const error = err as Error;
      this.logger.warn(
        `Chain withdraw attempt ${attemptNumber}/${MAX_RETRY_ATTEMPTS} failed for ${requestId}: ${error.message}`,
      );

      if (attemptNumber >= MAX_RETRY_ATTEMPTS) {
        // All retries exhausted — this will trigger handleWithdrawFailure via queue failure handler
        throw error;
      }

      // Wait before retry (BullMQ handles this via backoff, but we also wait for direct calls)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return this.executeChainWithdrawWithRetry(requestId, attemptNumber + 1);
    }
  }

  /**
   * Handle withdraw failure after all retries are exhausted.
   * Sends Telegram alert to admin, then refunds chips.
   */
  async handleWithdrawFailureAfterRetries(
    requestId: string,
    reason: string,
  ): Promise<void> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) return;
    if (request.status === 'CONFIRMED' || request.status === 'FAILED') return;

    // Send Telegram alert to admin
    await this.notificationService.sendAdminAlert(
      `⚠️ *提现链上转账失败（所有重试耗尽）*\n\n` +
        `• Request ID: \`${requestId}\`\n` +
        `• User: \`${request.userId}\`\n` +
        `• Amount: \`${request.amountUsdt} USDT\` (\`${request.amountChips} chips\`)\n` +
        `• To Address: \`${request.toAddress}\`\n` +
        `• 失败原因: ${reason}\n\n` +
        `💰 已自动退还用户chips。`,
    );

    await this.handleWithdrawFailure(requestId, reason);

    // Admin log for chain failure (distinct from WITHDRAW_REFUND logged in refundChips)
    try {
      await this.prisma.adminLog.create({
        data: {
          adminId: 'SYSTEM',
          action: 'WITHDRAW_CHAIN_FAILURE',
          targetType: 'USER',
          targetId: request.userId,
          detail: JSON.stringify({ requestId, reason }),
        },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to write WITHDRAW_CHAIN_FAILURE admin log: ${(e as Error).message}`,
      );
    }
  }

  /** Periodic check for stale PROCESSING requests (should not happen normally) */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkStaleProcessing(): Promise<void> {
    const stale = await this.prisma.withdrawRequest.findMany({
      where: { status: 'PROCESSING' },
      orderBy: { processedAt: 'asc' },
      take: 10,
    });

    for (const request of stale) {
      if (!request.txHash) {
        // No tx hash means transfer never started — re-enqueue for retry
        this.logger.warn(
          `Stale PROCESSING request without txHash: ${request.id}, re-enqueuing...`,
        );
        try {
          await this.withdrawQueue.enqueueWithdraw(request.id);
        } catch (err) {
          // Queue unavailable — fall back to direct retry
          this.logger.warn(
            `Queue unavailable for stale request: ${(err as Error).message}`,
          );
          void this.executeChainWithdrawWithRetry(request.id, 1).catch(
            (e: Error) => {
              void this.handleWithdrawFailure(request.id, e.message);
            },
          );
        }
      }
    }
  }
}
