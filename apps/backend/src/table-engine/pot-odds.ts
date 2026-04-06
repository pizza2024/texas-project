import { RANK_VALUES } from './constants';

export interface PotOddsResult {
  potOdds: number;
  potOddsPercent: number;
  callAmount: number;
  totalPotAfterCall: number;
  breakEvenEquity: number;
  breakEvenEquityPercent: number;
  isProfitable: boolean;
  impliedOdds?: {
    estimatedFuturePot: number;
    impliedPotOdds: number;
    impliedBreakEvenEquity: number;
  };
}

export interface HandEquityResult {
  winPercent: number;
  losePercent: number;
  tiePercent: number;
  equity: number;
}

export class PotOddsCalculator {
  static calculatePotOdds(
    currentPot: number,
    callAmount: number,
    playerEquity: number,
  ): PotOddsResult {
    const totalPotAfterCall = currentPot + callAmount;
    const potOdds = callAmount / totalPotAfterCall;
    const potOddsPercent = potOdds * 100;
    const breakEvenEquity = potOdds;
    const breakEvenEquityPercent = potOddsPercent;
    const isProfitable = playerEquity > breakEvenEquity;

    return {
      potOdds,
      potOddsPercent,
      callAmount,
      totalPotAfterCall,
      breakEvenEquity,
      breakEvenEquityPercent,
      isProfitable,
    };
  }

  static calculateImpliedOdds(
    currentPot: number,
    callAmount: number,
    playerEquity: number,
    estimatedFutureBets: number,
  ): PotOddsResult {
    const baseResult = this.calculatePotOdds(
      currentPot,
      callAmount,
      playerEquity,
    );
    const estimatedFuturePot = currentPot + estimatedFutureBets;
    const impliedPotOdds = callAmount / estimatedFuturePot;
    const impliedBreakEvenEquity = impliedPotOdds;

    return {
      ...baseResult,
      impliedOdds: {
        estimatedFuturePot,
        impliedPotOdds,
        impliedBreakEvenEquity,
      },
      isProfitable: playerEquity > impliedBreakEvenEquity,
    };
  }

  static estimatePreFlopEquity(
    holeCards: string[],
    opponentCount: number,
  ): number {
    if (holeCards.length !== 2) return 0.5;

    const [card1, card2] = holeCards.map((c) => c.slice(0, -1));
    const rank1 = RANK_VALUES[card1] ?? 0;
    const rank2 = RANK_VALUES[card2] ?? 0;
    const suit1 = holeCards[0].slice(-1);
    const suit2 = holeCards[1].slice(-1);
    const isSuited = suit1 === suit2;
    const isPaired = rank1 === rank2;
    const isConnected = Math.abs(rank1 - rank2) === 1;
    const isOneGap = Math.abs(rank1 - rank2) === 2;
    const isTwoGap = Math.abs(rank1 - rank2) === 3;

    let baseEquity = 0.5;

    if (isPaired) {
      baseEquity = 0.55 + (rank1 - 2) * 0.015;
      baseEquity -= (opponentCount - 1) * 0.08;
    } else if (isSuited && isConnected) {
      baseEquity = 0.52 + (Math.max(rank1, rank2) - 7) * 0.01;
      baseEquity -= (opponentCount - 1) * 0.09;
    } else if (isSuited && isOneGap) {
      baseEquity = 0.51 + (Math.max(rank1, rank2) - 8) * 0.008;
      baseEquity -= (opponentCount - 1) * 0.09;
    } else if (isConnected) {
      baseEquity = 0.5 + (Math.max(rank1, rank2) - 8) * 0.008;
      baseEquity -= (opponentCount - 1) * 0.1;
    } else if (!isPaired) {
      const highCard = Math.max(rank1, rank2);
      baseEquity = 0.48 + (highCard - 10) * 0.01;
      if (isSuited) baseEquity += 0.02;
      baseEquity -= (opponentCount - 1) * 0.11;
    }

    return Math.max(0, Math.min(1, baseEquity));
  }

  static estimateFlushDrawEquity(cardsToCome: number): number {
    const outs = 9;
    if (cardsToCome === 1) {
      return outs / 47;
    }
    const turnMiss = (47 - outs) / 47;
    const riverHit = outs / 46;
    return 1 - turnMiss * (1 - riverHit);
  }

  static estimateStraightDrawEquity(
    openEnded: boolean,
    gutshot: boolean,
    cardsToCome: number,
  ): number {
    let outs = 0;
    if (openEnded) outs = 8;
    else if (gutshot) outs = 4;

    if (cardsToCome === 1) {
      return outs / 47;
    }
    const turnMiss = (47 - outs) / 47;
    const riverHit = outs / 46;
    return 1 - turnMiss * (1 - riverHit);
  }

  static estimateMadeHandDrawEquity(
    ahead: boolean,
    dominated: boolean,
    cardsToCome: number,
  ): number {
    const baseEquity = ahead ? 0.9 : dominated ? 0.2 : 0.5;

    if (cardsToCome === 1) {
      return ahead ? 0.95 : 0.25;
    }

    return ahead ? 0.95 : dominated ? 0.15 : 0.5;
  }

  static calculateMinimumDefenseFrequency(potOdds: number): number {
    return 1 - potOdds;
  }

  static calculateOptimalBluffFrequency(
    potSize: number,
    bluffSize: number,
  ): number {
    const totalRisk = potSize + bluffSize;
    const bluffRatio = bluffSize / totalRisk;
    return 1 - bluffRatio;
  }

  static estimateStackPotRatio(stack: number, pot: number): number {
    if (pot === 0) return Infinity;
    return stack / pot;
  }

  static isEffectiveStackShort(
    stack: number,
    bigBlind: number,
    pot: number,
  ): boolean {
    const spr = this.estimateStackPotRatio(stack, pot);
    return spr < 5;
  }
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatChips(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}
