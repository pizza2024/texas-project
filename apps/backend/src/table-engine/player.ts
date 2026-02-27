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
  cards: string[]; // e.g., ['Ah', 'Kd']
  position: number; // Seat index 0-8
  isButton: boolean;
  hasActed: boolean;
}
