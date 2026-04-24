import { Player, PlayerStatus } from './player';

/**
 * Shared constants for the table-engine module.
 */
export const RANK_VALUES: Record<string, number> = {
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
};

/** Rake rate applied to pot winnings. */
export const RAKE_RATE = 0.03;
/** Maximum rake deducted per pot. */
export const RAKE_CAP = 30;

/**
 * Tier-based rake configuration (blind level → { rate, capPerHand })
 * Aligned with Productor's industry standard recommendations.
 */
export const TIER_RAKE_CONFIG: Record<string, { rate: number; cap: number }> = {
  MICRO: { rate: 0.05, cap: 0.3 },
  LOW: { rate: 0.04, cap: 0.5 },
  MEDIUM: { rate: 0.035, cap: 1.0 },
  HIGH: { rate: 0.03, cap: 2.0 },
  PREMIUM: { rate: 0.025, cap: 3.0 },
};

// ─── Exported interfaces & types ───────────────────────────────────────────

export interface HandResultEntry {
  playerId: string;
  nickname: string;
  handName: string;
  winAmount: number;
  /** Total chips this player contributed to the pot this hand (for P&L records). */
  totalBet: number;
  /** The best 5-card combination for showdown results (empty for fold-wins). */
  bestCards?: string[];
}

/**
 * Input type for adding a player to the table.
 * Accepts either a JWT payload (with `sub`) or a Player object (with `id`).
 * Internally normalized to always use `playerId`.
 */
export interface PlayerInput {
  /** User ID — JWT subject (`sub`). Present in JWT payloads. */
  sub?: string;
  /** User ID — Player.id. Present when re-converting Player objects (tests). */
  id?: string;
  nickname?: string;
  username?: string;
  avatar?: string;
  /** Bot players are auto-ready; humans default to false */
  ready?: boolean;
}

export interface StraddleInfo {
  playerId: string;
  amount: number;
  position: number;
}

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface TableSnapshot {
  id: string;
  roomId: string;
  players: (Player | null)[];
  deck: string[];
  communityCards: string[];
  pot: number;
  currentBet: number;
  currentStage: GameStage;
  activePlayerIndex: number;
  dealerIndex: number;
  minBet: number;
  lastHandResult: HandResultEntry[] | null;
  settlementEndsAt: number | null;
  readyCountdownEndsAt: number | null;
  actionEndsAt: number | null;
  isFoldWin: boolean;
  foldWinnerRevealed: boolean;
  straddle: StraddleInfo | null;
  calledAllIn: number | null;
  sittingOutTimeout: number;
  /** Room tier for rake calculation. */
  tier?: string;
  /** Rake deducted in the current hand. */
  rakeAmount?: number;
  /** Rake percentage applied. */
  rakePercent?: number;
}

export enum GameStage {
  WAITING = 'WAITING',
  DEALING = 'DEALING',
  PREFLOP = 'PREFLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
  SETTLEMENT = 'SETTLEMENT',
}

export interface TableConfig {
  sittingOutTimeout?: number; // milliseconds; defaults to 30000
}

// ─── Table state properties (for reference documentation) ─────────────────

/**
 * Core Table state fields.
 * These are declared on the Table class in table.ts.
 *
 * @property id                  Unique table identifier
 * @property roomId              Associated room identifier
 * @property players             Fixed-size array of seats (null = empty)
 * @property deck                Remaining deck cards
 * @property communityCards      Cards on the board
 * @property pot                 Total chips in the main pot
 * @property currentBet          Highest bet this street
 * @property currentStage         Current GameStage
 * @property activePlayerIndex    Index of player whose turn it is
 * @property dealerIndex          Index of the dealer button
 * @property smallBlind           Small blind amount
 * @property bigBlind            Big blind amount
 * @property minBuyIn             Minimum buy-in for table
 * @property roomPassword         Optional room password
 * @property minBet              Minimum raise amount
 * @property lastHandResult       Showdown / fold-win results
 * @property settlementEndsAt     Timestamp when settlement ends
 * @property readyCountdownEndsAt Timestamp when ready countdown ends
 * @property actionEndsAt         Timestamp when current action times out
 * @property isFoldWin            True when hand ended via opponent folds
 * @property foldWinnerRevealed   True when fold-win winner chose to reveal
 * @property straddle             UTG straddle info (null if no straddle)
 * @property calledAllIn          All-in amount that has been called this street
 * @property sittingOutTimeout    Auto-fold delay for sitting-out players
 * @property lastSitoutAutoFold   Last player auto-folded due to sitting out
 */
export interface TableState {
  id: string;
  roomId: string;
  players: (Player | null)[];
  deck: string[];
  communityCards: string[];
  pot: number;
  currentBet: number;
  currentStage: GameStage;
  activePlayerIndex: number;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  roomPassword: string | null;
  minBet: number;
  lastHandResult: HandResultEntry[] | null;
  settlementEndsAt: number | null;
  readyCountdownEndsAt: number | null;
  actionEndsAt: number | null;
  isFoldWin: boolean;
  foldWinnerRevealed: boolean;
  straddle: StraddleInfo | null;
  calledAllIn: number | null;
  sittingOutTimeout: number;
  lastSitoutAutoFold: { playerId: string; seatIndex: number } | null;
}
