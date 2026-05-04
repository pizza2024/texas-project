/**
 * Insurance Calculator
 *
 * Computes insurance fee and payout for All-In Insurance feature.
 *
 * Formulas:
 * - fee = floor(netLoss × (1 - equity) × (rate / 100))
 * - payout = floor(netLoss × (rate / 100))
 *
 * Where:
 * - netLoss: player's all-in amount minus settlement received
 * - equity: player's hand equity (0.0 - 1.0)
 * - rate: insurance coverage rate (50 or 100)
 */

/**
 * Calculate the insurance fee (cost to purchase insurance).
 *
 * @param netLoss - Player's net loss = allInAmount - settlementReceived
 * @param equity - Player's hand equity (0.0 - 1.0)
 * @param rate - Insurance rate (50 or 100)
 * @returns Insurance fee as BigInt (floor of calculation)
 */
export function calculateInsuranceFee(
  netLoss: number,
  equity: number,
  rate: number,
): bigint {
  if (netLoss <= 0 || rate <= 0) {
    return BigInt(0);
  }
  // equity = 0 is valid: player has no chance to win, grossLoss = netLoss

  // grossLoss = netLoss × (1 - equity) = expected loss due to coolers
  const grossLoss = netLoss * (1 - equity);

  // fee = floor(grossLoss × (rate / 100))
  const fee = Math.floor(grossLoss * (rate / 100));

  return BigInt(fee);
}

/**
 * Calculate the insurance payout (amount paid out if player loses).
 *
 * @param netLoss - Player's net loss = allInAmount - settlementReceived
 * @param rate - Insurance rate (50 or 100)
 * @returns Insurance payout as BigInt
 */
export function calculateInsurancePayout(
  netLoss: number,
  rate: number,
): bigint {
  if (netLoss <= 0 || rate <= 0) {
    return BigInt(0);
  }

  // payout = floor(netLoss × (rate / 100))
  const payout = Math.floor(netLoss * (rate / 100));

  return BigInt(payout);
}

/**
 * Insurance rate options available to players.
 */
export const INSURANCE_RATES = [50, 100] as const;
export type InsuranceRate = (typeof INSURANCE_RATES)[number];

/**
 * Insurance eligibility check result.
 */
export interface InsuranceEligibility {
  eligible: boolean;
  reason?: string;
}

/**
 * Check if a player is eligible for insurance.
 *
 * @param pot - Current pot size
 * @param bigBlind - Big blind amount
 * @param playerHasCards - Whether player has hole cards
 * @param minPotMultiplier - Minimum pot multiplier threshold (default: 10)
 * @returns Eligibility result
 */
export function checkInsuranceEligibility(
  pot: number,
  bigBlind: number,
  playerHasCards: boolean,
  minPotMultiplier = 10,
): InsuranceEligibility {
  if (!playerHasCards) {
    return { eligible: false, reason: 'Player has no cards' };
  }

  const minPot = bigBlind * minPotMultiplier;
  if (pot < minPot) {
    return {
      eligible: false,
      reason: `Pot ${pot} below minimum ${minPot}`,
    };
  }

  return { eligible: true };
}
