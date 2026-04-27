// Shared types for the Room game page

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  stack: number;
  bet: number;
  cards: string[];
  status: string;
  ready: boolean;
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  /** Consecutive action timeouts for Sit-Out Option C */
  consecutiveTimeouts?: number;
}

export interface HandResultEntry {
  playerId: string;
  nickname: string;
  handName: string;
  winAmount: number;
  /** Best 5-card combination for showdown results. */
  bestCards?: string[];
}

export interface TableState {
  id: string;
  pot: number;
  currentBet: number;
  bigBlind: number;
  communityCards: string[];
  players: (Player | null)[];
  currentStage: string;
  activePlayerIndex: number;
  lastHandResult?: HandResultEntry[] | null;
  settlementEndsAt?: number | null;
  readyCountdownEndsAt?: number | null;
  actionEndsAt?: number | null;
  isFoldWin?: boolean;
  foldWinnerRevealed?: boolean;
  straddle?: { playerId: string; amount: number; position: number } | null;
  isAnonymous?: boolean;
}

export interface ChipFlight {
  id: string;
  amount: number;
  top: number;
  left: number;
  delay: number;
  active: boolean;
}

export interface PayoutFlight {
  id: string;
  amount: number;
  top: number;
  left: number;
  delay: number;
  active: boolean;
}

export const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const DEAL_ANIMATION_MS = 420;
export const DEAL_STAGGER_MS = 90;
export const CHIP_FLIGHT_MS = 680;
export const CHIP_FLIGHT_STAGGER_MS = 70;
export const TABLE_SEAT_COUNT = 9;

export function getSeatPosition(index: number) {
  const angle = (index / TABLE_SEAT_COUNT) * 2 * Math.PI;
  const radius = 44;

  return {
    top: 50 + radius * Math.sin(angle),
    left: 50 + radius * Math.cos(angle),
  };
}
