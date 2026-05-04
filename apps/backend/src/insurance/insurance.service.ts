import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import {
  calculateInsuranceFee,
  calculateInsurancePayout,
} from '../table-engine/insurance-calculator';

export interface InsuranceOfferData {
  handId: string;
  pot: number;
  playerBet: number;
  playerEquity: number;
  fee50: number;
  payout50: number;
  fee100: number;
  payout100: number;
  timeoutMs: number;
  holeCards: string[];
}

export interface BuyInsuranceData {
  handId: string;
  rate: number;
}

@Injectable()
export class InsuranceService {
  private readonly logger = new Logger(InsuranceService.name);

  // Config defaults - can be overridden via environment
  private readonly MIN_POT_MULTIPLIER = 10;
  private readonly OFFER_TIMEOUT_MS = 5000;
  private readonly RAKE_PERCENT = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Get insurance configuration values.
   */
  getConfig() {
    return {
      minPotMultiplier: this.MIN_POT_MULTIPLIER,
      offerTimeoutMs: this.OFFER_TIMEOUT_MS,
      rakePercent: this.RAKE_PERCENT,
    };
  }

  /**
   * Calculate insurance offer details for a player.
   *
   * @param netLoss - Player's net loss (all-in bet - settlement)
   * @param equity - Player's hand equity
   * @returns Insurance offer details for both 50% and 100% rates
   */
  calculateInsuranceOffer(
    netLoss: number,
    equity: number,
  ): Pick<InsuranceOfferData, 'fee50' | 'payout50' | 'fee100' | 'payout100'> {
    // 50% insurance
    const fee50 = calculateInsuranceFee(netLoss, equity, 50);
    const payout50 = calculateInsurancePayout(netLoss, 50);

    // 100% insurance
    const fee100 = calculateInsuranceFee(netLoss, equity, 100);
    const payout100 = calculateInsurancePayout(netLoss, 100);

    return {
      fee50: Number(fee50),
      payout50: Number(payout50),
      fee100: Number(fee100),
      payout100: Number(payout100),
    };
  }

  /**
   * Record an insurance purchase in the database.
   *
   * @param params - Insurance purchase details
   * @returns Created insurance transaction
   */
  async recordInsurancePurchase(params: {
    handId: string;
    userId: string;
    roomId: string;
    tableId: string;
    rate: number;
    fee: bigint;
    payout: bigint;
    playerEquity: number;
    result: string;
  }) {
    const transaction = await this.prisma.insuranceTransaction.create({
      data: {
        handId: params.handId,
        userId: params.userId,
        roomId: params.roomId,
        tableId: params.tableId,
        rate: params.rate,
        fee: params.fee,
        payout: params.payout,
        playerEquity: params.playerEquity,
        result: params.result,
      },
    });

    this.logger.log(
      `Insurance recorded: user=${params.userId} hand=${params.handId} rate=${params.rate} fee=${params.fee} payout=${params.payout} result=${params.result}`,
    );

    return transaction;
  }

  /**
   * Settle insurance for a player at showdown.
   * If player lost (LOSE), pay out the insurance.
   * If player won (WIN), rake the fee.
   *
   * @param params - Settlement details
   * @returns Settlement result
   */
  async settleInsurance(params: {
    handId: string;
    userId: string;
    roomId: string;
    tableId: string;
    rate: number;
    fee: bigint;
    playerEquity: number;
    netLoss: number;
    playerWon: boolean;
  }): Promise<{ payout: bigint; rake: bigint }> {
    const { fee, playerWon } = params;

    if (playerWon) {
      // Player won - insurance fee is raked (house keeps it)
      const rake = this.calculateRake(fee);

      await this.recordInsurancePurchase({
        handId: params.handId,
        userId: params.userId,
        roomId: params.roomId,
        tableId: params.tableId,
        rate: params.rate,
        fee,
        payout: BigInt(0),
        playerEquity: params.playerEquity,
        result: 'WIN',
      });

      this.logger.log(
        `Insurance settled (WIN - raked): user=${params.userId} hand=${params.handId} fee=${fee} rake=${rake}`,
      );

      return { payout: BigInt(0), rake };
    } else {
      // Player lost - pay out insurance
      const payout = calculateInsurancePayout(params.netLoss, params.rate);

      await this.recordInsurancePurchase({
        handId: params.handId,
        userId: params.userId,
        roomId: params.roomId,
        tableId: params.tableId,
        rate: params.rate,
        fee,
        payout,
        playerEquity: params.playerEquity,
        result: 'LOSE',
      });

      // Credit payout to player's wallet
      await this.walletService.addChips(params.userId, Number(payout));

      this.logger.log(
        `Insurance settled (LOSE - payout): user=${params.userId} hand=${params.handId} fee=${fee} payout=${payout}`,
      );

      return { payout, rake: BigInt(0) };
    }
  }

  /**
   * Calculate the rake (house take) from insurance fees.
   * Default rake is 5% of the net insurance fee.
   */
  calculateRake(fee: bigint): bigint {
    const rakePercent = this.RAKE_PERCENT / 100;
    return BigInt(Math.floor(Number(fee) * rakePercent));
  }

  /**
   * Get paginated insurance transactions for admin.
   */
  async getInsuranceTransactions(params: {
    page: number;
    limit: number;
    handId?: string;
    userId?: string;
  }) {
    const { page, limit, handId, userId } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, string> = {};
    if (handId) where.handId = handId;
    if (userId) where.userId = userId;

    const [transactions, total] = await Promise.all([
      this.prisma.insuranceTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.insuranceTransaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get insurance statistics for admin dashboard.
   */
  async getInsuranceStats(params?: { startDate?: Date; endDate?: Date }) {
    const { startDate, endDate } = params ?? {};

    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [result] = await this.prisma.insuranceTransaction.groupBy({
      by: ['result'],
      where,
      _sum: {
        fee: true,
        payout: true,
      },
      _count: true,
    });

    // Get all results to properly aggregate
    const allTransactions = await this.prisma.insuranceTransaction.findMany({
      where,
      select: {
        fee: true,
        payout: true,
        result: true,
      },
    });

    let totalFees = BigInt(0);
    let totalPayouts = BigInt(0);
    let winCount = 0;
    let loseCount = 0;

    for (const tx of allTransactions) {
      totalFees += tx.fee;
      if (tx.result === 'LOSE') {
        totalPayouts += tx.payout;
        loseCount++;
      } else if (tx.result === 'WIN') {
        winCount++;
      }
    }

    const netRevenue = totalFees - totalPayouts;

    return {
      totalFees: totalFees.toString(),
      totalPayouts: totalPayouts.toString(),
      netRevenue: netRevenue.toString(),
      winCount,
      loseCount,
      totalTransactions: allTransactions.length,
      period:
        startDate && endDate
          ? { start: startDate.toISOString(), end: endDate.toISOString() }
          : null,
    };
  }

  /**
   * Check if a player has already purchased insurance for a hand.
   */
  async hasPurchasedInsurance(
    userId: string,
    handId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.insuranceTransaction.findFirst({
      where: { userId, handId },
    });
    return !!existing;
  }
}
