import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Player, PlayerStatus } from '../table-engine/player';

const BOT_ID_PREFIX = 'bot_';
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
        if (Math.random() < 0.3 && playerStack > minRaise) {
          return {
            action: 'raise',
            amount: this.randomRaise(minRaise, maxRaise),
          };
        }
        return { action: 'check', amount: 0 };
      }
      // Calling preflop: only with decent cards
      if (currentBet <= minRaise * 2) {
        const premium = this.isPremiumHand(gameState.communityCards, '');
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
      if (Math.random() < 0.4 && playerStack > minRaise) {
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
    const handStrength = this.estimateHandStrength(
      gameState.communityCards,
      communityCards,
    );

    if (potOdds < 0.3) {
      // Bad pot odds — mostly fold, occasionally call with made hands
      if (
        handStrength >= 0.6 ||
        (this.hasStrongDraw(gameState.communityCards, communityCards) &&
          Math.random() < 0.2)
      ) {
        return { action: 'call' };
      }
      return { action: 'fold' };
    } else if (potOdds < 0.5) {
      // Medium pot odds — call with made hands or strong draws
      if (
        handStrength >= 0.4 ||
        this.hasStrongDraw(gameState.communityCards, communityCards)
      ) {
        if (Math.random() < 0.3 && playerStack > minRaise) {
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
      if (Math.random() < 0.3 && playerStack > minRaise) {
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
    const r = Math.random();
    if (r < 0.5) return minRaise; // Min-raise
    if (r < 0.8) return Math.floor((minRaise + maxRaise) / 2); // Medium
    return maxRaise; // Max
  }

  /**
   * Very simple premium hand detection preflop.
   * Returns true for pairs, Broadway cards, suited connectors.
   */
  private isPremiumHand(_holeCards: string[], _community: string): boolean {
    // Simple placeholder — in production would analyze actual hole cards
    // when gameState provides them; for now we let decideAction use it loosely
    return false;
  }

  /**
   * Estimate hand strength 0-1 based on community cards.
   * Simplified — checks pairs, flush draws, straight draws.
   */
  private estimateHandStrength(
    _holeCards: string[],
    community: string[],
  ): number {
    if (community.length === 0) return 0.2;

    // Very simplified: just count community card rank diversity
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

    // Straight draw check (very simplified)
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

  private hasStrongDraw(_holeCards: string[], community: string[]): boolean {
    const allCards = [...community];
    const suits = allCards.map((c) => c[1]);
    const ranks = allCards.map((c) => c[0]);

    const suitCount: Record<string, number> = {};
    for (const s of suits) {
      suitCount[s] = (suitCount[s] ?? 0) + 1;
    }
    const flushDraw = Object.values(suitCount).some((c) => c >= 4);

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
    let straightDraw = false;
    for (let i = 0; i < rankVals.length - 1; i++) {
      if (rankVals[i + 1] - rankVals[i] <= 2) {
        straightDraw = true;
        break;
      }
    }

    return flushDraw || straightDraw;
  }
}
