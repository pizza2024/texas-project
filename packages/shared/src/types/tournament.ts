/**
 * Tournament types for SNG (Sit & Go), MTT (Multi-Table Tournament),
 * and BTC (Beat the Clock) support.
 */

/** Tournament type enum */
export enum TournamentType {
  SNG = 'SNG',
  MTT = 'MTT',
  BTC = 'BTC',
}

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
  type: TournamentType.SNG;
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

/** BTC (Beat the Clock) tournament configuration stored in Room.tournamentConfig */
export interface BtcConfig {
  type: TournamentType.BTC;
  buyin: number;
  maxPlayers: number; // typically 6 or 9 for BTC
  prizeDistribution: readonly [number, number, number]; // [60, 30, 10]
  blindSchedule: BlindLevel[];
  /** 0-indexed current blind level */
  currentBlindLevel: number;
  /** Unix timestamp (ms) when the current blind level started */
  blindLevelStartedAt: number;
  /** Total prize pool (buyin * maxPlayers) */
  totalPrize: number;
  /** Clock interval in seconds - how often a new level starts */
  clockIntervalSeconds: number;
  /** Number of levels before tournament ends */
  totalLevels: number;
  /** Current "clock tick" (level counter starting from 1) */
  currentTick: number;
}

/** Tournament configuration - stored as JSON in Room.tournamentConfig */
export type TournamentConfig = SngConfig | BtcConfig;

/** Check if a tournament config is SNG type */
export function isSngConfig(config: TournamentConfig): config is SngConfig {
  return config.type === TournamentType.SNG;
}

/** Check if a tournament config is BTC type */
export function isBtcConfig(config: TournamentConfig): config is BtcConfig {
  return config.type === TournamentType.BTC;
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

/** BTC default clock interval in seconds (30 seconds per level) */
export const BTC_CLOCK_INTERVAL_SECONDS = 30;

/** Default BTC blind schedule with faster levels than SNG */
export function createBtcBlindSchedule(startingBlind: number): BlindLevel[] {
  const levels: BlindLevel[] = [];
  let sb = startingBlind;
  let bb = startingBlind * 2;

  for (let level = 1; level <= 20; level++) {
    levels.push({
      level,
      smallBlind: sb,
      bigBlind: bb,
      durationSeconds: BTC_CLOCK_INTERVAL_SECONDS,
    });

    // Blind increase: roughly 2x every 3 levels
    if (level % 3 === 0) {
      sb = sb * 2;
      bb = bb * 2;
    }
  }

  return levels;
}

/** Default BTC parameters */
export const BTC_MAX_PLAYERS = 6;
export const BTC_INITIAL_CHIPS = 1500;
export const BTC_TOTAL_LEVELS = 20;

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
