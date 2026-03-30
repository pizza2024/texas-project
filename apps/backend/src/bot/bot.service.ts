import { Injectable } from '@nestjs/common';
import { Player, PlayerStatus } from '../table-engine/player';

const BOT_ID_PREFIX = 'bot_';
const BOT_AVATAR = '';

/**
 * Bot names pool for test environment (nicknames will have [Bot] prefix).
 * In production, bots disguise as real users.
 */
const TEST_BOT_NAMES = [
  'LuckyFish',
  'RiverRat',
  'CardShark',
  'BluffMaster',
  'PotKing',
  'ChipStack',
  'AllInAndy',
  'FoldPhil',
  'RaiseRita',
  'CallCathy',
  'AceHunter',
  'KingKiller',
  'QueenQuest',
  'Jackpot',
  'ShowdownSam',
];

const PROD_BOT_NAMES = [
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
  private readonly isTestEnv: boolean;

  constructor() {
    this.isTestEnv = process.env.NODE_ENV !== 'production';
  }

  /**
   * Create a bot player object.
   * @param nickname Optional nickname override
   */
  createBot(stack = 1000): BotPlayerData {
    const id = `${BOT_ID_PREFIX}${Date.now()}_${++this.botCounter}`;
    const namePool = this.isTestEnv ? TEST_BOT_NAMES : PROD_BOT_NAMES;
    const baseName = namePool[this.botCounter % namePool.length];
    const nickname = this.isTestEnv ? `[Bot] ${baseName}` : baseName;

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
   * Returns { action: 'fold' | 'call' | 'raise', amount?: number }
   */
  decideAction(gameState: GameStateForBot): {
    action: 'fold' | 'call' | 'raise';
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
      // Small blind / big blind situation: call if reasonable
      if (currentBet <= minRaise * 2) {
        return { action: 'call' };
      }
      // Randomly raise or fold based on pot odds
      const raiseChance = 0.3;
      if (Math.random() < raiseChance && playerStack > minRaise) {
        return {
          action: 'raise',
          amount: this.randomRaise(minRaise, maxRaise),
        };
      }
      return { action: 'fold' };
    }

    // Post-flop: simple heuristic based on pot size and current bet
    const potOdds = currentBet / (potSize + currentBet);

    // If we can check (currentBet === 0), sometimes bet
    if (currentBet === 0) {
      if (Math.random() < 0.4 && playerStack > minRaise) {
        return {
          action: 'raise',
          amount: this.randomRaise(minRaise, Math.min(maxRaise, potSize / 2)),
        };
      }
      return { action: 'fold' };
    }

    // Calling: use pot odds as a guide
    if (potOdds < 0.3) {
      // Bad pot odds — mostly fold
      return Math.random() < 0.2 ? { action: 'call' } : { action: 'fold' };
    } else if (potOdds < 0.5) {
      // Medium pot odds — call sometimes
      return Math.random() < 0.5 ? { action: 'call' } : { action: 'fold' };
    } else {
      // Good pot odds — mostly call
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
}
