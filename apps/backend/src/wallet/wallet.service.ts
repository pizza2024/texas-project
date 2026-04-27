import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { BOT_ID_PREFIX } from '../bot/bot.service';

@Injectable()
export class WalletService {
  private static readonly STARTING_CHIPS = 10000;
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns the player's current chip count (game currency). */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { chips: true },
    });

    if (wallet) {
      return wallet.chips;
    }

    // Fallback chain: Wallet not yet provisioned (new user) → fall back to
    // User.coinBalance. These two sources are intentionally kept in sync by
    // setBalance() which writes to both Wallet.chips and User.coinBalance.
    // The fallback exists for historical accounts created before the wallet
    // migration and should not occur for new users.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true },
    });

    return user?.coinBalance ?? WalletService.STARTING_CHIPS;
  }

  /** Overwrites a single player's chip balance. Also syncs User.coinBalance. */
  async setBalance(userId: string, balance: number): Promise<void> {
    const normalized = Math.max(0, balance);

    await this.prisma.$transaction([
      this.prisma.wallet.upsert({
        where: { userId },
        update: { chips: normalized },
        create: { userId, chips: normalized },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { coinBalance: normalized },
      }),
    ]);
  }

  /**
   * Batch-update chip balances for multiple players.
   * When `frozen = true` the frozenChips field is also set to the new chip
   * count (player is still seated at a table — prevents double-spend).
   */
  async setBalances(
    entries: Array<{ userId: string; balance: number }>,
    frozen = false,
  ): Promise<void> {
    if (entries.length === 0) return;

    // P1-NEW-003: Combine Phase 1 (wallet) + Phase 2 (user.coinBalance) into a
    // single atomic transaction. Previously they were separate $transaction calls —
    // if Phase 2 failed after Phase 1 succeeded, wallet.chips and user.coinBalance
    // would diverge, leaving the DB in an inconsistent state.
    try {
      await this.prisma.$transaction(
        entries.flatMap(({ userId, balance }) => {
          const normalized = Math.max(0, balance);
          // Upsert wallet record (works for bots and real users)
          const walletOp = this.prisma.wallet.upsert({
            where: { userId },
            update: {
              chips: normalized,
              frozenChips: frozen ? normalized : 0,
            },
            create: {
              userId,
              chips: normalized,
              frozenChips: frozen ? normalized : 0,
            },
          });

          // Sync user.coinBalance — skip for bot users (no User record).
          // Bot users are identified by BOT_ID_PREFIX and are skipped here
          // so that failures don't propagate; real users MUST have coinBalance in sync.
          if (userId.startsWith(BOT_ID_PREFIX)) {
            return [walletOp];
          }
          const userOp = this.prisma.user.update({
            where: { id: userId },
            data: { coinBalance: normalized },
          });
          return [walletOp, userOp];
        }),
      );
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        this.logger.error(
          `Prisma error in setBalances: ${error.code} - ${error.message}`,
          error.stack,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Lock a player's chips when they sit at a table.
   * The entire stack is frozen so they cannot join a second table.
   * Also decrements User.coinBalance by the frozen amount so that the
   * user's reported balance accurately reflects the frozen state.
   *
   * @throws BadRequestException if available balance is insufficient
   */
  async freezeBalance(userId: string, amount: number): Promise<void> {
    const normalized = Math.max(0, amount);
    if (normalized === 0) return;

    // P1-TEST-002: Guard against freezing more than available
    const available = await this.getAvailableBalance(userId);
    if (available < normalized) {
      throw new BadRequestException(
        `Insufficient balance: ${available} < ${normalized}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.wallet.upsert({
        where: { userId },
        update: { frozenChips: normalized },
        create: { userId, chips: normalized, frozenChips: normalized },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { coinBalance: { decrement: normalized } },
      }),
    ]);
  }

  /**
   * Atomically reset a player's chip balance AND unfreeze their chips.
   * Used during startup cleanup when a previous process exited without
   * properly removing players from waiting tables.
   *
   * Combines setBalance + unfreezeBalance into a single transaction
   * to prevent the race condition where balance is restored but
   * frozenChips remains non-zero (player cannot spend their chips).
   */
  async resetBalanceAndUnfreeze(
    userId: string,
    balance: number,
  ): Promise<void> {
    const normalized = Math.max(0, balance);
    await this.prisma.$transaction([
      this.prisma.wallet.upsert({
        where: { userId },
        update: { chips: normalized, frozenChips: 0 },
        create: { userId, chips: normalized, frozenChips: 0 },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { coinBalance: normalized },
      }),
    ]);
  }

  /**
   * Release frozen chips when a player leaves a table.
   * Increments User.coinBalance by the wallet's frozenChips amount so that
   * the user's reported balance is restored. Uses $transaction for atomicity.
   */
  async unfreezeBalance(userId: string): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { frozenChips: true },
    });
    const frozenAmount = wallet?.frozenChips ?? 0;
    await this.prisma.$transaction([
      this.prisma.wallet.updateMany({
        where: { userId },
        data: { frozenChips: 0 },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: frozenAmount } },
      }),
    ]);
  }

  /**
   * Spendable (non-frozen) chips.
   * While seated, frozenChips == chips, so availableBalance == 0.
   */
  async getAvailableBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { chips: true, frozenChips: true },
    });

    if (!wallet) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { coinBalance: true },
      });
      return user?.coinBalance ?? WalletService.STARTING_CHIPS;
    }

    return Math.max(0, wallet.chips - wallet.frozenChips);
  }

  /**
   * Get real-money USDT balance (separate from chips).
   */
  async getRealBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    });
    return wallet?.balance ?? 0;
  }

  /**
   * Exchange chips to real balance (USDТ).
   * Creates a withdraw request that can be processed later.
   * Rate: 100 chips = 1 USDT
   */
  async exchangeChipsToBalance(
    userId: string,
    chipsAmount: number,
    withdrawAddress: string,
  ): Promise<{
    withdrawId: string;
    usdtAmount: number;
    chipsDeducted: number;
  }> {
    const CHIPS_TO_USDT_RATE = 100;

    if (chipsAmount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // Validate withdraw address format: accept TRC20 (34 chars, starts with T),
    // ERC20 (42 chars, starts with 0x), or generic non-empty string (future chains).
    const trimmed = (withdrawAddress ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Withdraw address is required');
    }
    const isTrc20 = /^T[A-HJ-NP-Za-km-z1-9]{33}$/.test(trimmed);
    const isErc20 = /^0x[A-Fa-f0-9]{40}$/.test(trimmed);
    if (!isTrc20 && !isErc20) {
      throw new BadRequestException(
        'Invalid withdraw address: expected TRC20 (34 chars, T...) or ERC20 (42 chars, 0x...)',
      );
    }

    const usdtAmount = chipsAmount / CHIPS_TO_USDT_RATE;

    // Atomic: deduct chips and create withdraw request in a single transaction.
    // P1-NEW-004: Balance check (availableChips) must be INSIDE the transaction to
    // prevent TOCTOU double-spend — concurrent requests reading the same balance
    // before either writes would both pass the check and create duplicate withdraws.
    const withdrawRequest = await this.prisma.$transaction(async (tx) => {
      // Read current wallet balance and frozen chips inside transaction
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      // Fallback chain mirrors WalletService.getBalance(): wallet.chips → user.coinBalance → STARTING_BALANCE
      const currentBalance =
        wallet?.chips ??
        (
          await tx.user.findUnique({
            where: { id: userId },
            select: { coinBalance: true },
          })
        )?.coinBalance ??
        WalletService.STARTING_CHIPS;

      // Check available chips INSIDE transaction — prevents concurrent double-spend
      const frozenChips = wallet?.frozenChips ?? 0;
      const availableChips = Math.max(0, currentBalance - frozenChips);
      if (chipsAmount > availableChips) {
        throw new BadRequestException('Insufficient available chips');
      }

      // Deduct chips
      const newBalance = Math.max(0, currentBalance - chipsAmount);
      await tx.wallet.upsert({
        where: { userId },
        update: { chips: newBalance },
        create: { userId, chips: newBalance },
      });

      // Sync User.coinBalance
      await tx.user.update({
        where: { id: userId },
        data: { coinBalance: newBalance },
      });

      // Create withdraw request
      const request = await tx.withdrawRequest.create({
        data: {
          userId,
          amountChips: chipsAmount,
          amountUsdt: usdtAmount,
          toAddress: trimmed,
          status: 'PENDING',
        },
      });

      // Log transaction
      await tx.transaction.create({
        data: {
          userId,
          amount: -chipsAmount,
          type: 'WITHDRAW_REQUEST',
        },
      });

      return request;
    });

    return {
      withdrawId: withdrawRequest.id,
      usdtAmount,
      chipsDeducted: chipsAmount,
    };
  }

  /**
   * Exchange real balance (USDТ) to chips.
   * Rate: 1 USDT = 100 chips
   */
  async exchangeBalanceToChips(
    userId: string,
    usdtAmount: number,
  ): Promise<{ chipsAdded: number; usdtDeducted: number }> {
    const CHIPS_TO_USDT_RATE = 100;

    if (usdtAmount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const realBalance = await this.getRealBalance(userId);
    if (usdtAmount > realBalance) {
      throw new BadRequestException('Insufficient USDT balance');
    }

    const chipsToAdd = usdtAmount * CHIPS_TO_USDT_RATE;

    // P1-WALLET-001: wrap all DB writes in atomic transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId },
        update: {
          balance: { decrement: usdtAmount },
          chips: { increment: chipsToAdd },
        },
        create: {
          userId,
          balance: -usdtAmount,
          chips: chipsToAdd,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: chipsToAdd } },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount: chipsToAdd,
          type: 'EXCHANGE',
        },
      });
    });

    return {
      chipsAdded: chipsToAdd,
      usdtDeducted: usdtAmount,
    };
  }

  /**
   * Add chips to a user's wallet (e.g., from mission rewards).
   * Creates a MISSION_REWARD transaction log entry.
   */
  async addChips(userId: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    await this.prisma.$transaction([
      this.prisma.wallet.upsert({
        where: { userId },
        update: { chips: { increment: amount } },
        create: { userId, chips: amount, balance: 0, frozenChips: 0 },
      }),
      this.prisma.transaction.create({
        data: {
          userId,
          amount,
          type: 'MISSION_REWARD',
        },
      }),
    ]);
  }

  /**
   * Get withdraw request history for a user.
   */
  async getWithdrawHistory(userId: string) {
    return this.prisma.withdrawRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Admin: complete a withdraw request by processing the on-chain transfer.
   * This would be called after the USDT transfer is confirmed.
   */
  async completeWithdrawRequest(
    withdrawId: string,
    txHash: string,
  ): Promise<void> {
    await this.prisma.withdrawRequest.update({
      where: { id: withdrawId },
      data: { status: 'COMPLETED', txHash },
    });
  }

  /**
   * Admin: reject a withdraw request and refund the chips.
   * P1-NEW-009: entire flow wrapped in $transaction to prevent concurrent double-refund
   */
  async rejectWithdrawRequest(withdrawId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Re-check status inside transaction to prevent race condition
      const request = await tx.withdrawRequest.findUnique({
        where: { id: withdrawId },
      });

      if (!request) {
        throw new NotFoundException('Withdraw request not found');
      }

      if (request.status !== 'PENDING') {
        throw new BadRequestException('Can only reject pending requests');
      }

      // Read wallet balance inside transaction
      const wallet = await tx.wallet.findUnique({
        where: { userId: request.userId },
      });
      const currentBalance = wallet?.chips ?? 0;
      const newBalance = currentBalance + request.amountChips;

      // Update wallet + user.coinBalance + withdrawRequest status + transaction log — all atomic
      await tx.wallet.upsert({
        where: { userId: request.userId },
        update: { chips: newBalance },
        create: { userId: request.userId, chips: newBalance },
      });
      await tx.user.update({
        where: { id: request.userId },
        data: { coinBalance: newBalance },
      });
      await tx.withdrawRequest.update({
        where: { id: withdrawId },
        data: { status: 'REJECTED' },
      });
      await tx.transaction.create({
        data: {
          userId: request.userId,
          amount: request.amountChips,
          type: 'WITHDRAW_REFUND',
        },
      });
    });
  }

  /**
   * Unfreeze a player's chips and award additional chips (e.g., tournament prize).
   * Used when a tournament ends and winners receive their prizes.
   * The frozen chips are released back to available balance plus the prize amount.
   */
  async unfreezeAndAward(userId: string, prizeAmount: number): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { frozenChips: true, chips: true },
    });

    const frozenAmount = wallet?.frozenChips ?? 0;
    const currentChips = wallet?.chips ?? 0;

    // unfreeze + award: new balance = (current - frozen) + prize
    // Because current = frozen + available, this = available + prize
    const newBalance = Math.max(0, currentChips - frozenAmount + prizeAmount);

    await this.prisma.$transaction([
      this.prisma.wallet.upsert({
        where: { userId },
        update: { chips: newBalance, frozenChips: 0 },
        create: { userId, chips: newBalance, frozenChips: 0 },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { coinBalance: newBalance },
      }),
      this.prisma.transaction.create({
        data: {
          userId,
          amount: prizeAmount,
          type: 'TOURNAMENT_PRIZE',
        },
      }),
    ]);
  }
}
