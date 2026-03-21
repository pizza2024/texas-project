import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ethers, HDNodeWallet, Mnemonic } from 'ethers';
import BigNumber from 'bignumber.js';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

// 不使用科学计数法，精度足够大
BigNumber.config({ EXPONENTIAL_AT: 1e9, DECIMAL_PLACES: 18 });

const USDT_DECIMALS = 6;
const USDT_DECIMALS_BN = new BigNumber(10).pow(USDT_DECIMALS);
const USDT_TO_CHIPS_RATE = 100;
const FAUCET_COOLDOWN_MS = 60_000; // 60s per user

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
  ) {}

  private get usdtContractAddress(): string {
    return (
      process.env.USDT_CONTRACT_ADDRESS ??
      '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0'
    );
  }

  async getOrCreateDepositAddress(userId: string): Promise<string> {
    const existing = await this.prisma.depositAddress.findUnique({
      where: { userId },
    });
    if (existing) return existing.address;

    const aggregate = await this.prisma.depositAddress.aggregate({
      _max: { index: true },
    });
    // index=0 保留给 owner 钱包（合约部署账户），用户地址从 1 开始
    const nextIndex = Math.max(1, (aggregate._max.index ?? 0) + 1);

    const mnemonic = Mnemonic.fromPhrase(process.env.HD_WALLET_MNEMONIC!);
    const wallet = HDNodeWallet.fromMnemonic(
      mnemonic,
      `m/44'/60'/0'/0/${nextIndex}`,
    );
    const address = wallet.address;

    try {
      await this.prisma.depositAddress.create({
        data: { userId, address, index: nextIndex },
      });
    } catch (e: unknown) {
      // 并发竞态：另一个请求已先创建，直接返回已存在的记录
      if ((e as { code?: string })?.code === 'P2002') {
        const created = await this.prisma.depositAddress.findUnique({
          where: { userId },
        });
        if (created) return created.address;
      }
      throw e;
    }

    return address;
  }

  async getDepositHistory(userId: string) {
    return this.prisma.depositRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async faucet(userId: string): Promise<{ txHash: string; amount: number }> {
    if (process.env.FAUCET_ENABLED !== 'true') {
      throw new ForbiddenException('Faucet is disabled');
    }

    const mnemonicPhrase = process.env.HD_WALLET_MNEMONIC;
    const rpcUrl = process.env.ETH_RPC_URL;
    if (!mnemonicPhrase || !rpcUrl) {
      throw new ForbiddenException('Faucet not configured');
    }

    // Cooldown check
    const lastUsed = this.faucetCooldowns.get(userId) ?? 0;
    const remaining = FAUCET_COOLDOWN_MS - (Date.now() - lastUsed);
    if (remaining > 0) {
      throw new BadRequestException(
        `请等待 ${Math.ceil(remaining / 1000)} 秒后再试`,
      );
    }

    const depositAddress = await this.getOrCreateDepositAddress(userId);
    const faucetAmount = new BigNumber(process.env.FAUCET_AMOUNT_USDT ?? 100);
    // BigNumber → BigInt for ethers contract call
    const amountInUnits = BigInt(
      faucetAmount.multipliedBy(USDT_DECIMALS_BN).toFixed(0),
    );

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    // 用助记词 index=0 派生 owner 钱包（即部署合约时使用的账户）
    const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase);
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

    this.faucetCooldowns.set(userId, Date.now());
    this.logger.log(
      `Faucet: minted ${faucetAmount.toFixed()} USDT to ${depositAddress} (tx: ${tx.hash})`,
    );

    return { txHash: tx.hash, amount: faucetAmount.toNumber() };
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollDeposits(): Promise<void> {
    const addresses = await this.prisma.depositAddress.findMany();
    await Promise.all(
      addresses.map(({ address, userId }) =>
        this.checkAddressDeposits(address, userId).catch((err: Error) =>
          this.logger.error(
            `Failed to check deposits for ${address}: ${err.message}`,
          ),
        ),
      ),
    );
  }

  private async checkAddressDeposits(
    address: string,
    userId: string,
  ): Promise<void> {
    const rpcUrl = process.env.ETH_RPC_URL;
    if (!rpcUrl) {
      this.logger.warn('ETH_RPC_URL is not set, skipping deposit poll');
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(
      this.usdtContractAddress,
      TRANSFER_ABI,
      provider,
    );

    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 1000);
    const filter = contract.filters.Transfer(null, address);
    const events = await contract.queryFilter(filter, fromBlock, latestBlock);

    for (const event of events) {
      const log = event as ethers.EventLog;
      const txHash = log.transactionHash;
      const value = log.args[2] as bigint;

      const alreadyProcessed = await this.prisma.depositRecord.findUnique({
        where: { txHash },
      });
      if (alreadyProcessed) continue;

      // 全程 BigNumber 精确计算，避免 Number 对大额转账的精度损失
      const valueBN = new BigNumber(value.toString());
      const amount = valueBN.dividedBy(USDT_DECIMALS_BN);
      const chips = amount.multipliedBy(USDT_TO_CHIPS_RATE);

      const currentBalance = await this.walletService.getBalance(userId);
      const newBalance = new BigNumber(currentBalance).plus(chips);
      await this.walletService.setBalance(userId, newBalance.toNumber());

      await this.prisma.depositRecord.create({
        data: {
          userId,
          txHash,
          amount: amount.toNumber(),
          chips: chips.toNumber(),
          status: 'CONFIRMED',
        },
      });

      await this.prisma.transaction.create({
        data: { userId, amount: chips.toNumber(), type: 'DEPOSIT' },
      });

      this.logger.log(
        `Deposit processed: ${amount.toFixed()} USDT → ${chips.toFixed()} chips for user ${userId} (tx: ${txHash})`,
      );
    }
  }
}
