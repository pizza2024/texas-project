/**
 * Shared WebSocket constants used across the gateway and its handlers.
 * Centralizes magic numbers to prevent drift between app.gateway.ts and
 * game.handler.ts.
 */

/** Countdown before a solo player is auto-started (ms) */
export const SOLO_READY_COUNTDOWN_MS = 10_000;

/** Rate-limit window for player actions (ms) */
export const RATE_LIMIT_WINDOW_MS = 1_000;

/** Maximum actions allowed per rate-limit window */
export const RATE_LIMIT_MAX_ACTIONS = 10;

/** Maximum sane chip amount per action — prevents floating-point abuse and integer overflow */
export const MAX_CHIP_AMOUNT = 1_000_000_000;

/** Valid player actions in a hand */
export const VALID_ACTIONS = [
  'fold',
  'check',
  'call',
  'raise',
  'allin',
  'straddle',
  'sit-out',
] as const;

export type PlayerAction = (typeof VALID_ACTIONS)[number];

/** Optimized Set for O(1) lookup in hot paths */
export const VALID_ACTIONS_SET = new Set(VALID_ACTIONS);
