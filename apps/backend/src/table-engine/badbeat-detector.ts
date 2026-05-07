/**
 * Bad Beat Jackpot Detector
 *
 * Detects when a showdown qualifies for a Bad Beat Jackpot payout.
 *
 * Qualifying conditions:
 * 1. Both winner and loser must have QUADS (four of a kind) or higher
 * 2. Loser must have a strictly lower hand rank than winner
 * 3. Pot must be >= $100 (BAD_BEAT_MIN_POT)
 * 4. Both players must use at least one hole card (not pure community cards)
 * 5. At least one player was all-in pre-flop or on the flop
 */

import { evaluateHand, bestHandFrom, type HandScore } from './hand-evaluator';
import type { Player } from './player';

/** Minimum hand rank required for bad beat (QUADS = 8) */
export const BAD_BEAT_MIN_HAND = 'QUADS';
/** Minimum pot in dollars */
export const BAD_BEAT_MIN_POT = 100;
/** Hand rank values for comparison */
const HAND_RANK_QUADS = 8; // from hand-evaluator.ts HAND_NAMES index

export interface BadBeatEligibility {
  triggered: boolean;
  loserHandType: string;
  winnerHandType: string;
  eligible: {
    loserId: string;
    loserHand: string;
    loserBestCards: string[];
    winnerId: string;
    winnerHand: string;
    winnerBestCards: string[];
    netLoss: number; // in chips (for display)
  } | null;
  reason?: string;
}

export interface ShowdownPlayer {
  playerId: string;
  nickname: string;
  cards: string[];
  status: string; // ACTIVE, FOLD, ALLIN
  totalBet: number; // total chips bet this hand
}

export interface ShowdownResult {
  handId: string;
  tableId: string;
  roomId: string;
  pot: number; // pot size in chips (after rake)
  communityCards: string[];
  players: ShowdownPlayer[];
  /** Player IDs that were all-in pre-flop or on the flop */
  allInPlayerIds: string[];
  winnerId: string;
  /** Scores from hand-evaluator */
  handScores?: Map<string, HandScore>;
}

/**
 * Check if a showdown result qualifies as a Bad Beat.
 *
 * @param showdownResult - The showdown result containing all player info and hand scores
 * @param handRanker - Not used, kept for API compatibility
 */
export function isBadBeat(
  showdownResult: ShowdownResult,
  _handRanker?: unknown,
): BadBeatEligibility {
  // 1. Check minimum pot
  if (showdownResult.pot < BAD_BEAT_MIN_POT) {
    return {
      triggered: false,
      loserHandType: '',
      winnerHandType: '',
      eligible: null,
      reason: `Pot ${showdownResult.pot} below minimum ${BAD_BEAT_MIN_POT}`,
    };
  }

  // 2. Find all non-folded players with their hand scores
  const eligiblePlayers = showdownResult.players.filter(
    (p) => p.status !== 'FOLD' && p.cards.length > 0,
  );

  if (eligiblePlayers.length < 2) {
    return {
      triggered: false,
      loserHandType: '',
      winnerHandType: '',
      eligible: null,
      reason: 'Not enough eligible players',
    };
  }

  // 3. Evaluate hands for all non-folded players
  const playerScores: Array<{
    player: ShowdownPlayer;
    score: HandScore;
    holeCardsUsed: boolean;
  }> = [];

  for (const player of eligiblePlayers) {
    const allCards = [...player.cards, ...showdownResult.communityCards];
    const score = bestHandFrom(player.cards, showdownResult.communityCards);

    // Check if player used at least one hole card
    // If the best hand uses only community cards (5 community cards form the hand), holeCardsUsed = false
    const holeCardsUsed = score.bestCards.some((card) =>
      player.cards.includes(card),
    );

    playerScores.push({ player, score, holeCardsUsed });
  }

  // 4. Sort by hand rank (highest first)
  playerScores.sort((a, b) => {
    if (b.score.rank !== a.score.rank) return b.score.rank - a.score.rank;
    // Same rank: compare tiebreaker values
    for (
      let i = 0;
      i < Math.max(a.score.values.length, b.score.values.length);
      i++
    ) {
      const diff = (b.score.values[i] ?? 0) - (a.score.values[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  // 5. Get winner (highest hand) and loser (second highest hand that is strictly lower)
  const winner = playerScores[0];
  const loser = playerScores[1];

  if (!winner || !loser) {
    return {
      triggered: false,
      loserHandType: '',
      winnerHandType: '',
      eligible: null,
      reason: 'No winner/loser found',
    };
  }

  // 6. Both must be QUADS (rank >= 8)
  if (winner.score.rank < HAND_RANK_QUADS) {
    return {
      triggered: false,
      loserHandType: loser.score.name,
      winnerHandType: winner.score.name,
      eligible: null,
      reason: `Winner hand ${winner.score.name} below QUADS`,
    };
  }

  if (loser.score.rank < HAND_RANK_QUADS) {
    return {
      triggered: false,
      loserHandType: loser.score.name,
      winnerHandType: winner.score.name,
      eligible: null,
      reason: `Loser hand ${loser.score.name} below QUADS`,
    };
  }

  // 7. Loser must be strictly lower ranked than winner
  if (loser.score.rank >= winner.score.rank) {
    // Same rank - check tiebreaker
    let loserWinsTiebreaker = false;
    for (
      let i = 0;
      i < Math.max(winner.score.values.length, loser.score.values.length);
      i++
    ) {
      const diff = (loser.score.values[i] ?? 0) - (winner.score.values[i] ?? 0);
      if (diff > 0) {
        loserWinsTiebreaker = true;
        break;
      }
      if (diff < 0) break;
    }
    if (!loserWinsTiebreaker && loser.score.rank === winner.score.rank) {
      return {
        triggered: false,
        loserHandType: loser.score.name,
        winnerHandType: winner.score.name,
        eligible: null,
        reason: 'Loser does not have strictly lower hand than winner',
      };
    }
  }

  // 8. Both must use at least one hole card
  if (!winner.holeCardsUsed || !loser.holeCardsUsed) {
    return {
      triggered: false,
      loserHandType: loser.score.name,
      winnerHandType: winner.score.name,
      eligible: null,
      reason: 'One or both players did not use hole cards',
    };
  }

  // 9. At least one player must have been all-in pre-flop or on flop
  const allInSet = new Set(showdownResult.allInPlayerIds);
  const loserWasAllIn = allInSet.has(loser.player.playerId);
  const winnerWasAllIn = allInSet.has(winner.player.playerId);

  if (!loserWasAllIn && !winnerWasAllIn) {
    return {
      triggered: false,
      loserHandType: loser.score.name,
      winnerHandType: winner.score.name,
      eligible: null,
      reason: 'Neither player was all-in pre-flop or on flop',
    };
  }

  // 10. Calculate net loss for loser (for display purposes)
  const netLoss = loser.player.totalBet;

  return {
    triggered: true,
    loserHandType: loser.score.name,
    winnerHandType: winner.score.name,
    eligible: {
      loserId: loser.player.playerId,
      loserHand: loser.score.name,
      loserBestCards: loser.score.bestCards,
      winnerId: winner.player.playerId,
      winnerHand: winner.score.name,
      winnerBestCards: winner.score.bestCards,
      netLoss,
    },
  };
}
