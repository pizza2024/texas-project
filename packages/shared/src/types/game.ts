// 公共游戏类型定义，供 web 和 mobile 共用

// ── 用户 ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  coinBalance: number;
}

export interface UserStats {
  handsPlayed: number;
  handsWon: number;
  winRate: number;
  totalProfit: number;
  biggestWin: number;
  biggestLoss: number;
  recentHands: RecentHand[];
}

export interface RecentHand {
  id: string;
  potSize: number;
  profit: number;
  createdAt: string;
}

// ── 大厅 ────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  blindSmall: number;
  blindBig: number;
  maxPlayers: number;
  minBuyIn: number;
  isPrivate?: boolean;
  isClubOnly?: boolean;
  clubId?: string;
  isAnonymous?: boolean;
}

export interface RoomStatus {
  roomId: string;
  currentPlayers: number;
  maxPlayers: number;
  isFull: boolean;
  /** 'waiting' when table is idle, 'playing' when a hand is in progress */
  gameState?: "waiting" | "playing";
}

// ── 牌桌 ────────────────────────────────────────────────────────────────────

export type PlayerStatus =
  | "ACTIVE"
  | "FOLD"
  | "ALLIN"
  | "SITOUT"
  | "DISCONNECTED";

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  stack: number;
  bet: number; // Current round bet
  totalBet: number; // Total bet in this hand
  cards: string[];
  status: PlayerStatus;
  position: number; // Seat index (0-based)
  ready: boolean;
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  hasActed: boolean;
}

export interface HandResultEntry {
  playerId: string;
  nickname: string;
  handName: string;
  winAmount: number;
  bestCards?: string[];
}

export interface StraddleInfo {
  playerId: string;
  amount: number;
  position: number;
}

export type GameStage =
  | "WAITING"
  | "DEALING"
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN"
  | "SETTLEMENT";

export interface TableState {
  id: string;
  pot: number;
  currentBet: number;
  bigBlind: number;
  communityCards: string[];
  players: (Player | null)[];
  currentStage: GameStage;
  activePlayerIndex: number;
  lastHandResult?: HandResultEntry[] | null;
  settlementEndsAt?: number | null;
  readyCountdownEndsAt?: number | null;
  actionEndsAt?: number | null;
  isFoldWin?: boolean;
  foldWinnerRevealed?: boolean;
  straddle?: StraddleInfo | null;
  sittingOutTimeout?: number;
}

// ── 充值 ────────────────────────────────────────────────────────────────────

export interface DepositAddress {
  address: string;
  network: string;
  token: string;
  rate: number;
}

export interface DepositRecord {
  id: string;
  txHash: string;
  amount: number;
  chips: number;
  status: string;
  createdAt: string;
}

// ── WebSocket 事件 payload ───────────────────────────────────────────────────

export interface DepositConfirmedPayload {
  txHash: string;
  amount: number;
  chips: number;
}

export interface ForceLogoutPayload {
  reason: string;
  roomId?: string;
}

export interface MatchFoundPayload {
  roomId: string;
  tier: string;
}

export interface MatchErrorPayload {
  message: string;
  required?: number;
  roomId?: string;
}
