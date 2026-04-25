// Rakeback tier thresholds — shared between backend and frontend
// IMPORTANT: These values must stay in sync with the backend RakebackService.
// Update both locations when changing tier thresholds.

export type RakebackTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface RakebackTierConfig {
  tier: RakebackTier;
  /** Minimum cumulative totalRake to reach this tier */
  minRake: number;
  /** Rakeback rate as a percentage (e.g. 10 = 10%) */
  rate: number;
}

/**
 * Tier ladder — ordered from lowest to highest.
 * A user's tier is the highest tier whose minRake threshold they meet.
 */
export const RAKEBACK_TIERS: RakebackTierConfig[] = [
  { tier: 'BRONZE', minRake: 0, rate: 15 },
  { tier: 'SILVER', minRake: 500, rate: 22 },
  { tier: 'GOLD', minRake: 2_000, rate: 30 },
  { tier: 'PLATINUM', minRake: 10_000, rate: 40 },
  { tier: 'DIAMOND', minRake: 50_000, rate: 50 },
];

/** Get tier config for a given totalRake value */
export function getRakebackTier(totalRake: number): RakebackTierConfig {
  let tier = RAKEBACK_TIERS[0];
  for (const t of RAKEBACK_TIERS) {
    if (totalRake >= t.minRake) tier = t;
    else break;
  }
  return tier;
}

/** Get the next tier after the current one, or null if already at the highest tier */
export function getNextRakebackTier(
  currentTier: RakebackTier,
): RakebackTierConfig | null {
  const idx = RAKEBACK_TIERS.findIndex((t) => t.tier === currentTier);
  if (idx < 0 || idx >= RAKEBACK_TIERS.length - 1) return null;
  return RAKEBACK_TIERS[idx + 1];
}
