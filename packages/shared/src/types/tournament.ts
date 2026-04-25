/**
 * Tournament types for SNG (Sit & Go) and MTT (Multi-Table Tournament) support.
 */

/** SNG Buy-in levels */
export const SNG_BUYINS = [500, 1000, 2500, 5000] as const;
export type SngBuyin = (typeof SNG_BUYINS)[number];

/** Default SNG prize distribution: [1st place %, 2nd place %, 3rd place %] */
export const SNG_PRIZE_DISTRIBUTION = [60, 30, 10] as const;

/** Default SNG parameters */
export const SNG_MAX_PLAYERS = 8;
export const SNG_INITIAL_CHIPS = 1500;
export const SNG_BLIND_DURATION_SECONDS = 180; // 3 minutes

/** Blind level definition for tournament schedule */
export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  durationSeconds: number; // 180 (3 min) for SNG
}

/** SNG tournament configuration stored in Room.tournamentConfig */
export interface SngConfig {
  type: 'SNG';
  buyin: number;
  maxPlayers: number; // 8 for SNG
  prizeDistribution: readonly [number, number, number]; // [60, 30, 10]
  blindSchedule: BlindLevel[];
  /** 0-indexed current blind level */
  currentBlindLevel: number;
  /** Unix timestamp (ms) when the current blind level started */
  blindLevelStartedAt: number;
  /** Total prize pool (buyin * maxPlayers) */
  totalPrize: number;
}

/** Tournament configuration - stored as JSON in Room.tournamentConfig */
export type TournamentConfig = SngConfig;

/** Check if a tournament config is SNG type */
export function isSngConfig(config: TournamentConfig): config is SngConfig {
  return config.type === 'SNG';
}

/** Default blind schedule for SNG tournaments */
export function createDefaultBlindSchedule(startingBlind: number): BlindLevel[] {
  const levels: BlindLevel[] = [];
  let sb = startingBlind;
  let bb = startingBlind * 2;

  for (let level = 1; level <= 20; level++) {
    levels.push({
      level,
      smallBlind: sb,
      bigBlind: bb,
      durationSeconds: SNG_BLIND_DURATION_SECONDS,
    });

    // Blind increase: roughly 2x every 3 levels
    if (level % 3 === 0) {
      sb = sb * 2;
      bb = bb * 2;
    }
  }

  return levels;
}

/** Prize distribution entry for API responses */
export interface PrizePosition {
  place: number;
  percentage: number;
  chips: number;
}

/** API response for GET /rooms/:id/prizes */
export interface PrizeDistributionResponse {
  buyin: number;
  totalPrize: number;
  maxPlayers: number;
  positions: PrizePosition[];
}
