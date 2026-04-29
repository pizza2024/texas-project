/**
 * Tournament types for SNG (Sit & Go), MTT (Multi-Table Tournament),
 * and BTC (Beat the Clock) support.
 */

/** Tournament type enum */
export enum TournamentType {
  SNG = 'SNG',
  MTT = 'MTT',
  BTC = 'BTC',
  BLAST = 'BLAST',
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
export type TournamentConfig = SngConfig | BtcConfig | BlastConfig;

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

// ── Blast (Instant Tournament) ─────────────────────────────────────────────────

/**
 * Blast is a 3-player instant tournament inspired by GGPoker SPINS.
 * Key mechanics:
 * - 3 players, 3-minute duration
 * - Prize pool multiplier (2x–10,000x) revealed at start
 * - Base prize pool = buyin × 3 × multiplier
 * - Faster blind increases than SNG (every 2 minutes)
 * - Auto-start when 3 players fill the room
 */
export const BLAST_MAX_PLAYERS = 3;
export const BLAST_INITIAL_CHIPS = 1500;
export const BLAST_BLIND_DURATION_SECONDS = 120; // 2 minutes
export const BLAST_DEFAULT_DURATION_SECONDS = 180; // 3 minutes total

/** Blast buy-in levels (in chips) */
export const BLAST_BUYINS = [500, 1000, 2500, 5000, 10000] as const;
export type BlastBuyin = (typeof BLAST_BUYINS)[number];

/** Blast prize multiplier range */
export const BLAST_MIN_MULTIPLIER = 2;
export const BLAST_MAX_MULTIPLIER = 1000;

/** Default Blast prize distribution: [1st place %, 2nd place %, 3rd place %] */
export const BLAST_PRIZE_DISTRIBUTION = [70, 20, 10] as const;

/** Blast tournament configuration stored in Room.blastConfig */
export interface BlastConfig {
  type: TournamentType.BLAST;
  /** Buy-in amount in chips */
  buyin: number;
  maxPlayers: typeof BLAST_MAX_PLAYERS;
  /** Prize distribution percentages [1st, 2nd, 3rd] */
  prizeDistribution: readonly [number, number, number];
  /** Multiplier drawn at tournament start (e.g., 10 for 10x) */
  multiplier: number;
  /** Unix timestamp (ms) when the tournament started */
  startedAt: number;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Unix timestamp (ms) when the tournament ends */
  endsAt: number;
  /** 0-indexed current blind level */
  currentBlindLevel: number;
  /** Unix timestamp (ms) when the current blind level started */
  blindLevelStartedAt: number;
  /**
   * Pre-computed prize pool = buyin × 3 × multiplier
   * This is the total prize for ALL players combined (not per-player)
   */
  totalPrizePool: number;
}

/** Blind level definition for Blast (faster schedule than SNG) */
export interface BlastBlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  durationSeconds: number; // 120 (2 min) for Blast
}

/** Create the default blind schedule for Blast tournaments */
export function createBlastBlindSchedule(startingBlind: number): BlastBlindLevel[] {
  const levels: BlastBlindLevel[] = [];
  let sb = startingBlind;
  let bb = startingBlind * 2;

  // Blast is 3 minutes max, blinds double every 2 minutes
  // So we have at most 2 levels: level 1 and level 2 (final)
  for (let level = 1; level <= 2; level++) {
    levels.push({
      level,
      smallBlind: sb,
      bigBlind: bb,
      durationSeconds: BLAST_BLIND_DURATION_SECONDS,
    });

    // Double every level (faster than SNG)
    sb = sb * 2;
    bb = bb * 2;
  }

  return levels;
}

/** Draw a random prize multiplier for a Blast tournament */
export function drawBlastMultiplier(): number {
  // Multiplier tiers (aligned with SpinWheel 9 segments per P2-NEW-024):
  // 2x, 3x, 5x, 10x — common (60%)
  // 15x, 25x, 50x — uncommon (30%)
  // 100x, 1000x — rare (10%)
  const randomBytes = new Uint32Array(4);
  crypto.getRandomValues(randomBytes);
  const roll = (randomBytes[0] / 0xffffffff) * 100;

  if (roll < 60) {
    // Common: 2x to 10x (4 values)
    const tier = randomBytes[1] % 4;
    return [2, 3, 5, 10][tier];
  } else if (roll < 90) {
    // Uncommon: 15x to 50x (3 values)
    const tier = randomBytes[2] % 3;
    return [15, 25, 50][tier];
  } else {
    // Rare: 100x or 1000x (2 values)
    const tier = randomBytes[3] % 2;
    return [100, 1000][tier];
  }
}

/** Check if a tournament config is Blast type */
export function isBlastConfig(config: TournamentConfig): config is BlastConfig {
  return config.type === TournamentType.BLAST;
}

// ── Blast Lobby (Redis queue entry) ───────────────────────────────────────────

/**
 * Represents a waiting Blast lobby stored in Redis.
 * Players join via POST /rooms/blast/:id/join and are matched
 * when 3 players fill the room.
 */
export interface BlastLobby {
  /** UUID matching Room.id */
  id: string;
  /** Buy-in amount in chips */
  buyin: number;
  /** Player userIds who have joined (max 3) */
  playerIds: string[];
  /** Always 3 for Blast */
  maxPlayers: typeof BLAST_MAX_PLAYERS;
  /** Current status of the lobby */
  status: 'waiting' | 'starting' | 'active';
  /** Unix timestamp (ms) when lobby was created */
  createdAt: number;
  /** userId of the player who created this lobby */
  creatorId: string;
  /** Small blind for this lobby */
  smallBlind: number;
  /** Big blind for this lobby */
  bigBlind: number;
  /** Optional password for the lobby */
  password?: string;
}

/** Redis key for the Blast lobby waiting queue (list) */
export const BLAST_LOBBY_QUEUE_KEY = 'blast:lobby:queue';

/** Redis key prefix for individual lobby entries (hash) */
export const BLAST_LOBBY_KEY_PREFIX = 'blast:lobby:';

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
