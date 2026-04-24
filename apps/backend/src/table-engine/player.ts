export enum PlayerStatus {
  ACTIVE = 'ACTIVE',
  FOLD = 'FOLD',
  ALLIN = 'ALLIN',
  SITOUT = 'SITOUT',
  DISCONNECTED = 'DISCONNECTED',
}

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  stack: number;
  bet: number; // Current round bet
  totalBet: number; // Total bet in this hand
  status: PlayerStatus;
  cards: string[]; // e.g. ['Ah', 'Kd']
  position: number; // Seat index 0-8
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  hasActed: boolean;
  ready: boolean; // Whether player is ready to start the game
  /** Consecutive action timeouts in the current sit-out session (Option C). */
  consecutiveTimeouts: number;
}
