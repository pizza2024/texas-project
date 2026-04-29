import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ethers, HDNodeWallet, Mnemonic } from 'ethers';
import BigNumber from 'bignumber.js';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { RedisService } from '../redis/redis.service';
import {
  MissionService,
  MISSION_KEY_FIRST_DEPOSIT,
} from '../mission/mission.service';
import { getHdWalletMnemonic } from '../config/jwt.config';
import { WebSocketManager } from '../websocket/websocket-manager';

// Bonus wagering multiplier: user must wager 5× the bonus amount before unlocking it
const BONUS_WAGERING_MULTIPLIER = 5;

// 不使用科学计数法，精度足够大
BigNumber.config({ EXPONENTIAL_AT: 1e9, DECIMAL_PLACES: 18 });

const USDT_DECIMALS = 6;
const USDT_DECIMALS_BN = new BigNumber(10).pow(USDT_DECIMALS);
const USDT_TO_CHIPS_RATE = 100;
const FAUCET_COOLDOWN_MS = 60_000; // 60s per user
const FAUCET_COOLDOWN_KEY = (userId: string) => `faucet_cooldown:${userId}`;

const TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const MINT_ABI = ['function mint(address to, uint256 amount) external'];

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);
  private readonly faucetCooldowns = new Map<string, number>(); // userId -> last faucet timestamp

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly redisService: RedisService,
    private readonly missionService: MissionService,
    @Inject(forwardRef(() => WebSocketManager))
    private readonly wsManager: WebSocketManager,
  ) {}

  private get usdtContractAddress(): string {
    return (
      process.env.USDT_CONTRACT_ADDRESS ??
      '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0'
    );
  }

  async getOrCreateDepositAddress(userId: string): Promise<string> {
    // Fast path: already exists — no transaction needed.
    const existing = await this.prisma.depositAddress.findUnique({
      where: { userId },
    });
    if (existing) return existing.address;

    // Serialize concurrent inserts via a transaction.
    // This prevents two concurrent requests from reading the same _max.index
    // and generating duplicate HD wallet addresses.
    return this.prisma.$transaction(async (tx) => {
      // Re-check inside transaction — another request may have just inserted.
      const existingInside = await tx.depositAddress.findUnique({
        where: { userId },
      });
      if (existingInside) return existingInside.address;

      const aggregate = await tx.depositAddress.aggregate({
        _max: { index: true },
      });
      // index=0 保留给 owner 钱包（合约部署账户），用户地址从 1 开始
      const nextIndex = Math.max(1, (aggregate._max.index ?? 0) + 1);

      const mnemonic = Mnemonic.fromPhrase(getHdWalletMnemonic());
      const wallet = HDNodeWallet.fromMnemonic(
        mnemonic,
        `m/44'/60'/0'/0/${nextIndex}`,
      );
      const address = wallet.address;

      // Use createMany with skipDuplicates to handle the rare race where
      // another concurrent request committed the same (userId, index) between
      // our aggregate read and this insert. The unique constraint on userId
      // guards against duplicate user records; skipDuplicates silences the
      // index conflict rather than throwing.
      await tx.depositAddress.createMany({
        data: { userId, address, index: nextIndex },
        skipDuplicates: true,
      });

      // Fetch the record — either ours or the winner's from the race.
      const record = await tx.depositAddress.findUnique({
        where: { userId },
      });

      return record!.address;
    });
  }

  async getDepositHistory(userId: string) {
    return this.prisma.depositRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // ── Bonus status ─────────────────────────────────────────────────────────────

  /**
   * Returns the user's first-deposit bonus status and wagering progress.
   * Returns null if no bonus has been created yet.
   */
  async getBonusStatus(userId: string) {
    const bonus = await this.prisma.depositBonus.findUnique({
      where: { userId },
    });
    if (!bonus) return null;

    const wageringRemaining = Math.max(
      0,
      bonus.wageringRequirement - bonus.wageringProgress,
    );
    const isCompleted = bonus.status === 'COMPLETED';

    return {
      depositAmount: bonus.depositAmount,
      bonusAmount: bonus.bonusAmount,
      wageringRequirement: bonus.wageringRequirement,
      wageringProgress: bonus.wageringProgress,
      wageringRemaining,
      status: bonus.status,
      isUnlocked: isCompleted,
      createdAt: bonus.createdAt,
      completedAt: bonus.completedAt,
    };
  }

  // ── Wagering tracking ────────────────────────────────────────────────────────

  /**
   * Called by the table engine after each hand to credit wagering progress
   * toward the active deposit bonus rollover requirement.
   *
   * Only chips actually risked (not just the bet amount) count here — a fold
   * with no chips put in does NOT count. The table engine should pass the
   * total chips the player put at risk during the hand.
   *
   * Idempotent: once the bonus is COMPLETED, subsequent calls are no-ops.
   */
  async addWagering(userId: string, chipsWagered: number): Promise<void> {
    if (chipsWagered <= 0) return;

    const bonus = await this.prisma.depositBonus.findUnique({
      where: { userId },
    });

    if (!bonus || bonus.status !== 'ACTIVE') return;

    const newProgress = Math.min(
      bonus.wageringProgress + chipsWagered,
      bonus.wageringRequirement,
    );
    const isComplete = newProgress >= bonus.wageringRequirement;

    await this.prisma.depositBonus.update({
      where: { id: bonus.id },
      data: {
        wageringProgress: newProgress,
        status: isComplete ? 'COMPLETED' : 'ACTIVE',
        completedAt: isComplete ? new Date() : undefined,
      },
    });

    this.logger.debug(
      `[addWagering] user=${userId} chipsWagered=${chipsWagered} progress=${newProgress}/${bonus.wageringRequirement} completed=${isComplete}`,
    );
  }

  async faucet(userId: string): Promise<{ txHash: string; amount: number }> {
    if (process.env.FAUCET_ENABLED !== 'true') {
      throw new ForbiddenException('Faucet is disabled');
    }

    const rpcUrl = process.env.ETH_RPC_URL;
    if (!rpcUrl) {
      throw new ForbiddenException('Faucet not configured');
    }

    // Cooldown check — Redis-backed with in-memory fallback
    try {
      const ttl = await this.redisService.ttl(FAUCET_COOLDOWN_KEY(userId));
      if (ttl > 0) {
        throw new BadRequestException(`请等待 ${Math.ceil(ttl)} 秒后再试`);
      }
      // Key absent / expired in Redis — clear any stale in-memory entry
      this.faucetCooldowns.delete(userId);
    } catch {
      // Redis unavailable — use in-memory fallback
      const lastUsed = this.faucetCooldowns.get(userId) ?? 0;
      const remaining = FAUCET_COOLDOWN_MS - (Date.now() - lastUsed);
      if (remaining > 0) {
        throw new BadRequestException(
          `请等待 ${Math.ceil(remaining / 1000)} 秒后再试`,
        );
      }
    }

    const depositAddress = await this.getOrCreateDepositAddress(userId);
    const faucetAmount = new BigNumber(process.env.FAUCET_AMOUNT_USDT ?? 100);
    // BigNumber → BigInt for ethers contract call
    const amountInUnits = BigInt(
      faucetAmount.multipliedBy(USDT_DECIMALS_BN).toFixed(0),
    );

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    // 用助记词 index=0 派生 owner 钱包（即部署合约时使用的账户）
    const mnemonic = Mnemonic.fromPhrase(getHdWalletMnemonic());
    const ownerWallet = HDNodeWallet.fromMnemonic(
      mnemonic,
      `m/44'/60'/0'/0/0`,
    ).connect(provider);
    const contract = new ethers.Contract(
      this.usdtContractAddress,
      MINT_ABI,
      ownerWallet,
    );

    const tx = (await contract.mint(
      depositAddress,
      amountInUnits,
    )) as ethers.ContractTransactionResponse;
    await tx.wait(1);

    // Update cooldown — Redis with in-memory fallback
    try {
      await this.redisService.set(
        FAUCET_COOLDOWN_KEY(userId),
        String(Date.now()),
        Math.ceil(FAUCET_COOLDOWN_MS / 1000),
      );
    } catch {
      // Redis unavailable — in-memory fallback only
    }
    this.faucetCooldowns.set(userId, Date.now());
    this.logger.log(
      `Faucet: minted ${faucetAmount.toFixed()} USDT to ${depositAddress} (tx: ${tx.hash})`,
    );

    return { txHash: tx.hash, amount: faucetAmount.toNumber() };
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollDeposits(): Promise<void> {
    const rpcUrl = process.env.ETH_RPC_URL;
    if (!rpcUrl) {
      this.logger.warn('ETH_RPC_URL is not set, skipping deposit poll');
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Get the latest block and determine the scan range using persisted cursor.
    // This prevents missing events when the sliding window (latestBlock-1000)
    // doesn't cover the block where a faucet tx was confirmed.
    const [cursor, latestBlock] = await Promise.all([
      this.prisma.scanCursor.findUnique({ where: { id: 'singleton' } }),
      provider.getBlockNumber(),
    ]);

    // Fallback: use last 1000 blocks if no cursor exists yet
    let fromBlock = cursor
      ? Math.max(0, Number(cursor.lastBlock) + 1)
      : Math.max(0, latestBlock - 1000);

    // Guard: if the node was restarted (e.g. Hardhat reset) and latestBlock
    // is now much lower than the cursor, reset the scan window and the cursor.
    if (fromBlock > latestBlock) {
      this.logger.warn(
        `[pollDeposits] cursor (${fromBlock}) exceeds latestBlock (${latestBlock}) — likely a node restart. Resetting scan window.`,
      );
      fromBlock = Math.max(0, latestBlock - 100);
      // Immediately persist the reset cursor so we don't keep hitting this case.
      await this.prisma.scanCursor.upsert({
        where: { id: 'singleton' },
        update: { lastBlock: BigInt(latestBlock), updatedAt: new Date() },
        create: { id: 'singleton', lastBlock: BigInt(latestBlock) },
      });
    }

    this.logger.debug(
      `[pollDeposits] scanning fromBlock=${fromBlock} latestBlock=${latestBlock} cursor.lastBlock=${cursor?.lastBlock ?? 'null'}`,
    );

    const addresses = await this.prisma.depositAddress.findMany();

    // Use Promise.allSettled so one failure doesn't cancel others, and so we
    // can track whether at least one query succeeded before advancing the cursor.
    const results = await Promise.allSettled(
      addresses.map(({ address, userId }) =>
        this.checkAddressDeposits(address, userId, fromBlock, latestBlock),
      ),
    );

    const anySucceeded = results.some((r) => r.status === 'fulfilled');

    // Only advance the cursor if at least one query succeeded.
    // (If all failed — e.g. the node is still syncing — the next run will
    // retry from the same position.)
    if (anySucceeded) {
      await this.prisma.scanCursor.upsert({
        where: { id: 'singleton' },
        update: { lastBlock: BigInt(latestBlock), updatedAt: new Date() },
        create: { id: 'singleton', lastBlock: BigInt(latestBlock) },
      });
    } else {
      this.logger.debug(
        `[pollDeposits] all queries failed — cursor not advanced (latestBlock=${latestBlock})`,
      );
    }
  }

  private async checkAddressDeposits(
    address: string,
    userId: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<void> {
    const rpcUrl = process.env.ETH_RPC_URL!;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(
      this.usdtContractAddress,
      TRANSFER_ABI,
      provider,
    );

    const filter = contract.filters.Transfer(null, address);
    const events = await contract.queryFilter(filter, fromBlock, toBlock);

    this.logger.debug(
      `[checkAddressDeposits] address=${address} userId=${userId} fromBlock=${fromBlock} toBlock=${toBlock} eventsFound=${events.length}`,
    );

    for (const event of events) {
      const log = event as ethers.EventLog;
      const txHash = log.transactionHash;
      const blockNumber = log.blockNumber;
      const value = log.args[2] as bigint;

      this.logger.debug(
        `[checkAddressDeposits] event: txHash=${txHash} block=${blockNumber} value=${value}`,
      );

      const alreadyProcessed = await this.prisma.depositRecord.findUnique({
        where: { txHash },
      });
      if (alreadyProcessed) {
        this.logger.debug(
          `[checkAddressDeposits] already processed: ${txHash}`,
        );
        continue;
      }

      // 全程 BigNumber 精确计算，避免 Number 对大额转账的精度损失
      const valueBN = new BigNumber(value.toString());
      const amount = valueBN.dividedBy(USDT_DECIMALS_BN);
      const chips = amount.multipliedBy(USDT_TO_CHIPS_RATE);

      this.logger.debug(
        `[checkAddressDeposits] crediting: userId=${userId} chips=${chips.toNumber()} txHash=${txHash}`,
      );

      // Atomic: read balance + write (wallet + depositRecord + transaction) in a single transaction.
      // This prevents race conditions where concurrent deposits for the same user could result
      // in lost balance updates (double-spend on read-then-write gap).
      await this.prisma.$transaction(async (tx) => {
        // Read current wallet balance inside the transaction to hold a consistent snapshot
        const wallet = await tx.wallet.findUnique({
          where: { userId },
          select: { chips: true },
        });
        const currentBalance = wallet?.chips ?? 0;
        const newBalance = new BigNumber(currentBalance).plus(chips);

        // Update wallet.chips and sync user.coinBalance
        await tx.wallet.upsert({
          where: { userId },
          update: { chips: newBalance.toNumber() },
          create: {
            userId,
            chips: newBalance.toNumber(),
            balance: 0,
            frozenChips: 0,
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { coinBalance: newBalance.toNumber() },
        });

        // Record the deposit
        await tx.depositRecord.create({
          data: {
            userId,
            txHash,
            amount: amount.toNumber(),
            chips: chips.toNumber(),
            status: 'CONFIRMED',
          },
        });

        // Log the transaction
        await tx.transaction.create({
          data: { userId, amount: chips.toNumber(), type: 'DEPOSIT' },
        });
      });

      // First Deposit Bonus — delegated to MissionService
      // (also sets hasReceivedFirstDepositBonus flag on User for backwards compat)
      const userForBonus = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { hasReceivedFirstDepositBonus: true },
      });
      if (!userForBonus?.hasReceivedFirstDepositBonus) {
        // Retrieve the mission definition to know the bonus amount
        const mission = await this.prisma.mission.findUnique({
          where: { key: MISSION_KEY_FIRST_DEPOSIT },
        });
        const bonusAmount = mission?.rewardChips ?? 10000;

        await this.missionService.progressMission(
          userId,
          MISSION_KEY_FIRST_DEPOSIT,
        );

        // Create the DepositBonus wagering record for this first deposit
        await this.prisma.depositBonus.create({
          data: {
            userId,
            depositAmount: amount.toNumber(),
            bonusAmount,
            wageringRequirement: bonusAmount * BONUS_WAGERING_MULTIPLIER,
            wageringProgress: 0,
            status: 'ACTIVE',
          },
        });

        await this.prisma.user.update({
          where: { id: userId },
          data: { hasReceivedFirstDepositBonus: true },
        });

        this.logger.log(
          `First Deposit Bonus: triggered P1-FIRST-DEPOSIT mission + created DepositBonus for user ${userId} (${bonusAmount} chips, ${BONUS_WAGERING_MULTIPLIER}× wagering)`,
        );
      }

      this.logger.log(
        `Deposit processed: ${amount.toFixed()} USDT → ${chips.toFixed()} chips for user ${userId} (tx: ${txHash})`,
      );

      // Push real-time notification so the client can update balance without polling.
      // newBalance is queried after the transaction commits to capture the committed value.
      try {
        const updated = await this.prisma.wallet.findUnique({
          where: { userId },
          select: { chips: true },
        });
        const newBalance = updated?.chips ?? 0;
        this.wsManager.emitToUser(userId, 'deposit_confirmed', {
          txHash,
          amount: amount.toNumber(),
          chips: chips.toNumber(),
          newBalance,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        this.logger.warn(`Failed to emit deposit_confirmed WS event for user ${userId}: ${(err as Error).message}`);
      }
    }
  }
}
