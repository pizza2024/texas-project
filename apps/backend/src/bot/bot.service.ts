import { Injectable } from '@nestjs/common';
import { randomUUID, randomInt } from 'crypto';
import { Player, PlayerStatus } from '../table-engine/player';
import { bestHandFrom } from '../table-engine/hand-evaluator';

export const BOT_ID_PREFIX = 'bot_';
const BOT_AVATAR = '';

const IS_TEST = process.env.NODE_ENV !== 'production';

/**
 * Bot names pool — names are picked with a uniqueness suffix to avoid
 * duplicates within a session. Production bots disguise as real users;
 * test bots get [Bot] prefix.
 */
const BOT_NAMES = [
  'AlexChen',
  'JamieWong',
  'ChrisLiu',
  'TaylorM',
  'JordanK',
  'CaseyP',
  'RileyS',
  'MorganL',
  'QuinnA',
  'DrewB',
  '虾虾',
  '皮皮',
  '小德',
  '德哥',
  '虾客',
  '红龙',
  '蓝鲸',
  '黑桃',
  '方块',
  '梅花',
];

const BOT_NAMES_TEST = [
  '[Bot]虾虾',
  '[Bot]皮皮',
  '[Bot]小德',
  '[Bot]德哥',
  '[Bot]虾客',
  '[Bot]LuckyFish',
  '[Bot]RiverRat',
  '[Bot]CardShark',
  '[Bot]BluffMaster',
  '[Bot]PotKing',
];

export interface BotPlayerData {
  id: string;
  nickname: string;
  avatar: string;
  stack: number;
  bet: number;
  totalBet: number;
  status: PlayerStatus;
  cards: string[];
  position: number;
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  hasActed: boolean;
  ready: boolean;
}

export interface GameStateForBot {
  holeCards: string[];
  communityCards: string[];
  currentBet: number; // The amount needed to call
  minRaise: number;
  maxRaise: number;
  potSize: number;
  playerStack: number;
}

@Injectable()
export class BotService {
  private botCounter = 0;

  private pickBotName(): string {
    const pool = IS_TEST ? BOT_NAMES_TEST : BOT_NAMES;
    const base = pool[this.botCounter % pool.length];
    const uniqueSuffix = Math.floor(this.botCounter / pool.length);
    this.botCounter++;
    return uniqueSuffix > 0 ? `${base}#${uniqueSuffix}` : base;
  }

  /**
   * Create a bot player object.
   * @param stack Initial chip stack (default 1000)
   */
  createBot(stack = 1000): BotPlayerData {
    const id = `${BOT_ID_PREFIX}${randomUUID()}`;
    const nickname = this.pickBotName();

    return {
      id,
      nickname,
      avatar: BOT_AVATAR,
      stack,
      bet: 0,
      totalBet: 0,
      status: PlayerStatus.ACTIVE,
      cards: [],
      position: -1, // Will be set by table.addPlayer
      isButton: false,
      isSmallBlind: false,
      isBigBlind: false,
      hasActed: false,
      ready: true, // Bots auto-ready
    };
  }

  /**
   * Simple bot AI decision: fold / call / raise.
   * Returns { action: 'fold' | 'call' | 'raise' | 'check', amount?: number }
   */
  decideAction(gameState: GameStateForBot): {
    action: 'fold' | 'call' | 'raise' | 'check';
    amount?: number;
  } {
    const {
      holeCards,
      communityCards,
      currentBet,
      minRaise,
      maxRaise,
      potSize,
      playerStack,
    } = gameState;

    // No community cards yet — preflop: play tighter
    if (communityCards.length === 0) {
      if (currentBet === 0) {
        // Preflop: 30% chance to raise as opener
        if (randomInt(100) < 30 && playerStack > minRaise) {
          return {
            action: 'raise',
            amount: this.randomRaise(minRaise, maxRaise),
          };
        }
        return { action: 'check', amount: 0 };
      }
      // Calling preflop: only with decent cards
      if (currentBet <= minRaise * 2) {
        const premium = this.isPremiumHand(gameState.holeCards);
        if (premium || currentBet <= minRaise) {
          return { action: 'call' };
        }
      }
      if (currentBet <= playerStack * 0.1) {
        return { action: 'call' };
      }
      return { action: 'fold' };
    }

    // Post-flop: no outstanding bet — sometimes probe bet
    if (currentBet === 0) {
      if (randomInt(100) < 40 && playerStack > minRaise) {
        return {
          action: 'raise',
          amount: this.randomRaise(
            minRaise,
            Math.min(maxRaise, Math.floor(potSize / 2)),
          ),
        };
      }
      return { action: 'check', amount: 0 };
    }

    // Must call or fold post-flop
    const potOdds = currentBet / (potSize + currentBet);
    const handStrength = this.estimateHandStrength(holeCards, communityCards);

    if (potOdds < 0.3) {
      // Bad pot odds — mostly fold, occasionally call with made hands
      if (
        handStrength >= 0.6 ||
        (this.hasStrongDraw(holeCards, communityCards) && randomInt(100) < 20)
      ) {
        return { action: 'call' };
      }
      return { action: 'fold' };
    } else if (potOdds < 0.5) {
      // Medium pot odds — call with made hands or strong draws
      if (
        handStrength >= 0.4 ||
        this.hasStrongDraw(holeCards, communityCards)
      ) {
        if (randomInt(100) < 30 && playerStack > minRaise) {
          return {
            action: 'raise',
            amount: this.randomRaise(minRaise, maxRaise),
          };
        }
        return { action: 'call' };
      }
      return { action: 'fold' };
    } else {
      // Good pot odds — mostly call, sometimes raise
      if (randomInt(100) < 30 && playerStack > minRaise) {
        return {
          action: 'raise',
          amount: this.randomRaise(minRaise, maxRaise),
        };
      }
      return { action: 'call' };
    }
  }

  private randomRaise(minRaise: number, maxRaise: number): number {
    if (maxRaise <= minRaise) return minRaise;
    const r = randomInt(100);
    if (r < 50) return minRaise; // Min-raise 50%
    if (r < 80) return Math.floor((minRaise + maxRaise) / 2); // Medium 30%
    return maxRaise; // Max 20%
  }

  /**
   * Detect premium preflop hands.
   * Returns true for pairs, Broadway combos, and strong suited connectors.
   */
  private isPremiumHand(holeCards: string[]): boolean {
    if (holeCards.length < 2) return false;
    const [c1, c2] = holeCards;
    const rank1 = c1[0];
    const rank2 = c2[0];
    const suit1 = c1[1];
    const suit2 = c2[1];
    const isSuited = suit1 === suit2;

    // Normalize ranks to uppercase
    const r1 = rank1.toUpperCase();
    const r2 = rank2.toUpperCase();

    // Helper to compare ranks
    const higher = r1 >= r2 ? r1 : r2;
    const lower = r1 >= r2 ? r2 : r1;

    // Pairs
    const pairs = [
      'AA',
      'KK',
      'QQ',
      'JJ',
      'TT',
      '99',
      '88',
      '77',
      '66',
      '55',
      '44',
      '33',
      '22',
    ];
    if (r1 === r2 && pairs.includes(r1 + r1)) return true;

    // Broadway combos (both suited and offsuit)
    const broadway = [
      'AK',
      'AQ',
      'AJ',
      'AT',
      'KQ',
      'KJ',
      'KT',
      'QJ',
      'QT',
      'JT',
    ];
    const combo = higher + lower;
    if (broadway.includes(combo)) return true;

    // Strong suited connectors
    const strongConnectors = ['T9', '98', '87', '76', '65', '54'];
    if (isSuited && strongConnectors.includes(lower + higher)) return true;

    return false;
  }

  /**
   * Estimate hand strength 0-1 based on hole cards and community cards.
   * Uses bestHandFrom for actual hand evaluation when community cards exist.
   */
  private estimateHandStrength(
    holeCards: string[],
    community: string[],
  ): number {
    // Preflop: use premium hand detection
    if (community.length === 0) {
      return this.isPremiumHand(holeCards) ? 0.65 : 0.2;
    }

    // Post-flop: combine hole cards with community and evaluate
    if (holeCards.length >= 2 && community.length >= 3) {
      const result = bestHandFrom(holeCards, community);
      const rank = result.rank; // 1=high card, 10=royal flush

      // Map rank 1-10 to 0-1 score
      // rank 10 (royal flush) = 1.0, rank 1 (high card) ~= 0.05
      const baseScore = (11 - rank) / 10;

      // Also check for draws as a moderate boost
      const drawBoost = this.hasStrongDraw(holeCards, community) ? 0.1 : 0;

      return Math.min(1.0, baseScore + drawBoost);
    }

    // Fallback: community-only analysis
    const ranks = community.map((c) => c[0]);
    const rankCount: Record<string, number> = {};
    for (const r of ranks) {
      rankCount[r] = (rankCount[r] ?? 0) + 1;
    }
    const maxPair = Math.max(...Object.values(rankCount), 0);

    if (maxPair >= 3) return 0.8; // trips or better
    if (maxPair === 2) return 0.5; // one pair

    const suits = community.map((c) => c[1]);
    const suitCount: Record<string, number> = {};
    for (const s of suits) {
      suitCount[s] = (suitCount[s] ?? 0) + 1;
    }
    const hasFlushDraw = Object.values(suitCount).some((c) => c >= 4);
    if (hasFlushDraw) return 0.45;

    // Straight draw check
    const rankVals = ranks
      .map((r) => {
        const v =
          {
            '2': 2,
            '3': 3,
            '4': 4,
            '5': 5,
            '6': 6,
            '7': 7,
            '8': 8,
            '9': 9,
            T: 10,
            J: 11,
            Q: 12,
            K: 13,
            A: 14,
          }[r] ?? 0;
        return v;
      })
      .sort((a, b) => a - b);
    let hasStraightDraw = false;
    for (let i = 0; i < rankVals.length - 1; i++) {
      if (rankVals[i + 1] - rankVals[i] <= 2) {
        hasStraightDraw = true;
        break;
      }
    }
    if (hasStraightDraw) return 0.35;

    return 0.2;
  }

  /**
   * Detect strong draws: flush draws, open-ended straight draws, gutshots.
   * Uses both hole cards and community cards for complete picture.
   */
  private hasStrongDraw(holeCards: string[], community: string[]): boolean {
    const allCards = [...holeCards, ...community];
    const suits = allCards.map((c) => c[1]);
    const ranks = allCards.map((c) => c[0]);

    // Check suit counts for flush draws
    const suitCount: Record<string, number> = {};
    for (const s of suits) {
      suitCount[s] = (suitCount[s] ?? 0) + 1;
    }
    const flushDraw = Object.values(suitCount).some((c) => c >= 4);
    const hasFlush = Object.values(suitCount).some((c) => c >= 5);

    // Check for straight draws
    const rankVals = [...new Set(ranks)]
      .map((r) => {
        const v =
          {
            '2': 2,
            '3': 3,
            '4': 4,
            '5': 5,
            '6': 6,
            '7': 7,
            '8': 8,
            '9': 9,
            T: 10,
            J: 11,
            Q: 12,
            K: 13,
            A: 14,
          }[r.toUpperCase()] ?? 0;
        return v;
      })
      .sort((a, b) => a - b);

    // Open-ended straight draw: 4 consecutive ranks
    let openEnded = false;
    let gutshot = false;
    for (let i = 0; i < rankVals.length - 3; i++) {
      if (
        rankVals[i + 1] === rankVals[i] + 1 &&
        rankVals[i + 2] === rankVals[i] + 2 &&
        rankVals[i + 3] === rankVals[i] + 3
      ) {
        openEnded = true;
        break;
      }
    }

    // Gutshot: one card fills a straight
    if (!openEnded && rankVals.length >= 4) {
      for (let i = 0; i < rankVals.length - 3; i++) {
        if (
          rankVals[i + 3] === rankVals[i] + 4 &&
          rankVals
            .slice(i, i + 3)
            .every((v, _, arr) => arr[0] + 1 === v || true)
        ) {
          // Check if there's a rank gap of 4
          const sortedRanks = rankVals.slice(i, i + 4).sort((a, b) => a - b);
          if (sortedRanks[3] - sortedRanks[0] === 4) {
            gutshot = true;
            break;
          }
        }
      }
    }

    return flushDraw || openEnded || gutshot;
  }
}
