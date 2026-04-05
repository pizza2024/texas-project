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
import { CreateWithdrawDto } from './dto/create-withdraw.dto';
import { WithdrawRequest, Prisma } from '@prisma/client';

BigNumber.config({ EXPONENTIAL_AT: 1e9, DECIMAL_PLACES: 18 });

const USDT_DECIMALS = 6;
const USDT_DECIMALS_BN = new BigNumber(10).pow(USDT_DECIMALS);
const USDT_TO_CHIPS_RATE = 100;
const WITHDRAW_COOLDOWN_MS = 60_000; // 60 seconds
const WITHDRAW_COOLDOWN_KEY = (userId: string) => `withdraw_cooldown:${userId}`;
const MIN_WITHDRAW_CHIPS = 1000;

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
   * Check and consume cooldown. Uses Redis TTL when available; falls back to
   * in-memory Map (for single-instance dev/test environments).
   */
  private async checkAndConsumeCooldown(userId: string): Promise<void> {
    try {
      const ttl = await this.redisService.ttl(WITHDRAW_COOLDOWN_KEY(userId));
      if (ttl > 0) {
        throw new BadRequestException(
          `请等待 ${Math.ceil(ttl)} 秒后再试`,
        );
      }
      // Key absent / expired in Redis — clear any stale in-memory entry
      this.cooldowns.delete(userId);
      return;
    } catch {
      // Redis unavailable — use in-memory fallback
    }
    const lastUsed = this.cooldowns.get(userId) ?? 0;
    const remaining = WITHDRAW_COOLDOWN_MS - (Date.now() - lastUsed);
    if (remaining > 0) {
      throw new BadRequestException(
        `请等待 ${Math.ceil(remaining / 1000)} 秒后再试`,
      );
    }
  }

  /** Set cooldown timestamp after successful withdraw creation */
  private async setCooldown(userId: string): Promise<void> {
    try {
      await this.redisService.set(
        WITHDRAW_COOLDOWN_KEY(userId),
        String(Date.now()),
        Math.ceil(WITHDRAW_COOLDOWN_MS / 1000),
      );
    } catch {
      // Redis unavailable — in-memory fallback only
    }
    // Always update in-memory fallback
    this.cooldowns.set(userId, Date.now());
  }

  /** Get remaining cooldown for a user */
  async getCooldownRemaining(userId: string): Promise<{
    remainingMs: number;
    canWithdraw: boolean;
  }> {
    try {
      const ttlSeconds = await this.redisService.ttl(WITHDRAW_COOLDOWN_KEY(userId));
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

    // Set cooldown
    await this.setCooldown(userId);

    // Log transaction
    await this.prisma.transaction.create({
      data: {
        userId,
        amount: -dto.amountChips,
        type: 'WITHDRAW',
      },
    });

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
      // Refund chips to user
      await this.refundChips(request.userId, request.amountChips, id);

      const updated = await this.prisma.withdrawRequest.update({
        where: { id },
        data: {
          status: 'FAILED',
          failureReason: reason ?? 'Rejected by admin',
          processedAt: new Date(),
        },
      });

      await this.prisma.adminLog.create({
        data: {
          adminId,
          action: 'WITHDRAW_REJECT',
          targetType: 'USER',
          targetId: request.userId,
          detail: JSON.stringify({ requestId: id, reason }),
        },
      });

      this.logger.log(`Withdraw rejected: id=${id}, reason=${reason}`);
      return updated;
    }

    // APPROVE: move to PROCESSING and trigger chain transfer
    const updated = await this.prisma.withdrawRequest.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        processedAt: new Date(),
      },
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

    // Execute chain transfer asynchronously (fire-and-forget)
    void this.executeChainWithdraw(id).catch((err: Error) => {
      this.logger.error(`Chain withdraw failed for ${id}: ${err.message}`);
      void this.handleWithdrawFailure(id, err.message);
    });

    this.logger.log(`Withdraw approved and processing: id=${id}`);
    return updated;
  }

  /** Refund chips to user after reject or failure */
  private async refundChips(
    userId: string,
    amountChips: number,
    requestId: string,
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

    this.logger.log(
      `Withdraw refund: user=${userId}, chips=${amountChips}, requestId=${requestId}`,
    );
  }

  /** Execute USDT transfer on-chain */
  async executeChainWithdraw(requestId: string): Promise<string> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Withdraw request not found');
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

    // Save txHash immediately
    await this.prisma.withdrawRequest.update({
      where: { id: requestId },
      data: { txHash: tx.hash },
    });

    // Wait for 1 confirmation
    await tx.wait(1);

    // Update to CONFIRMED
    await this.prisma.withdrawRequest.update({
      where: { id: requestId },
      data: { status: 'CONFIRMED' },
    });

    this.logger.log(
      `Withdraw confirmed on-chain: id=${requestId}, txHash=${tx.hash}`,
    );
    return tx.hash;
  }

  /** Handle chain withdrawal failure — refund chips */
  async handleWithdrawFailure(
    requestId: string,
    reason: string,
  ): Promise<void> {
    const request = await this.prisma.withdrawRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) return;
    if (request.status === 'CONFIRMED' || request.status === 'FAILED') return;

    await this.prisma.withdrawRequest.update({
      where: { id: requestId },
      data: {
        status: 'FAILED',
        failureReason: reason,
      },
    });

    await this.refundChips(request.userId, request.amountChips, requestId);
    this.logger.log(
      `Withdraw failed and refunded: id=${requestId}, reason=${reason}`,
    );
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
        // No tx hash means transfer never started — retry
        this.logger.warn(
          `Stale PROCESSING request without txHash: ${request.id}, retrying...`,
        );
        void this.executeChainWithdraw(request.id).catch((err: Error) => {
          void this.handleWithdrawFailure(request.id, err.message);
        });
      }
    }
  }
}
