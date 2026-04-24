/**
 * Equity calculation using Monte Carlo simulation.
 * Pure function — no backend dependencies.
 */

export const RANK_VALUES: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const VALID_SUITS = new Set(['s', 'h', 'd', 'c']);
const ALL_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const ALL_SUITS = ['s', 'h', 'd', 'c'];

function isValidCard(card: string): boolean {
  if (typeof card !== 'string' || card.length < 2 || card.length > 3) return false;
  const suit = card.slice(-1).toLowerCase();
  const rank = card.slice(0, -1).toUpperCase();
  return VALID_SUITS.has(suit) && rank in RANK_VALUES;
}

function parseRank(card: string): number {
  return RANK_VALUES[card.slice(0, -1).toUpperCase()];
}

function parseSuit(card: string): string {
  return card.slice(-1);
}

export interface HandScore {
  rank: number; // 1–10
  values: number[]; // tiebreaker values, high to low
  name: string;
  bestCards: string[];
}

const HAND_NAMES: Record<number, string> = {
  1: '高牌',
  2: '一对',
  3: '两对',
  4: '三条',
  5: '顺子',
  6: '同花',
  7: '葫芦',
  8: '四条',
  9: '同花顺',
  10: '皇家同花顺',
};

function evaluate5(cards: string[]): HandScore {
  const ranks = cards.map(parseRank).sort((a, b) => b - a);
  const suits = cards.map(parseSuit);

  const rankCount = new Map<number, number>();
  for (const r of ranks) rankCount.set(r, (rankCount.get(r) ?? 0) + 1);

  const groups = [...rankCount.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const counts = groups.map((g) => g[1]);
  const groupRanks = groups.map((g) => g[0]);

  const isFlush = suits.length >= 5 && new Set(suits).size === 1;

  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[0];
    }
    if (
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isFlush && isStraight) {
    const handRank = straightHigh === 14 ? 10 : 9;
    return { rank: handRank, values: [straightHigh], name: HAND_NAMES[handRank], bestCards: cards };
  }
  if (counts[0] === 4) {
    return { rank: 8, values: [groupRanks[0], groupRanks[1]], name: HAND_NAMES[8], bestCards: cards };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    return { rank: 7, values: [groupRanks[0], groupRanks[1]], name: HAND_NAMES[7], bestCards: cards };
  }
  if (isFlush) {
    return { rank: 6, values: ranks, name: HAND_NAMES[6], bestCards: cards };
  }
  if (isStraight) {
    return { rank: 5, values: [straightHigh], name: HAND_NAMES[5], bestCards: cards };
  }
  if (counts[0] === 3) {
    return { rank: 4, values: groupRanks, name: HAND_NAMES[4], bestCards: cards };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    const kicker = ranks.filter((r) => r !== groupRanks[0] && r !== groupRanks[1])[0];
    return { rank: 3, values: [groupRanks[0], groupRanks[1], kicker], name: HAND_NAMES[3], bestCards: cards };
  }
  if (counts[0] === 2) {
    return { rank: 2, values: groupRanks, name: HAND_NAMES[2], bestCards: cards };
  }
  return { rank: 1, values: ranks, name: HAND_NAMES[1], bestCards: cards };
}

function compareScores(a: HandScore, b: HandScore): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.values.length, b.values.length); i++) {
    const diff = (a.values[i] ?? 0) - (b.values[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function combinations(cards: string[], k: number): string[][] {
  if (k === 0) return [[]];
  if (cards.length < k) return [];
  const [first, ...rest] = cards;
  return [
    ...combinations(rest, k - 1).map((c) => [first, ...c]),
    ...combinations(rest, k),
  ];
}

function bestHandFrom(holeCards: string[], communityCards: string[]): HandScore {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) {
    const score = evaluate5(all);
    score.bestCards = all;
    return score;
  }
  const combos = combinations(all, 5);
  let best: HandScore | null = null;
  let bestCards: string[] = [];
  for (const combo of combos) {
    const score = evaluate5(combo);
    if (!best || compareScores(score, best) > 0) {
      best = score;
      bestCards = combo;
    }
  }
  if (best) {
    best.bestCards = bestCards;
    return best;
  }
  const fallback = evaluate5(all.slice(0, 5));
  fallback.bestCards = all.slice(0, 5);
  return fallback;
}

/** Shuffle array in place (Fisher-Yates) */
function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Generate a random hand that doesn't overlap with used cards.
 */
function randomHand(usedCards: Set<string>): string[] {
  const available: string[] = [];
  for (const rank of ALL_RANKS) {
    for (const suit of ALL_SUITS) {
      const card = rank + suit;
      if (!usedCards.has(card)) available.push(card);
    }
  }
  shuffle(available);
  return available.slice(0, 2);
}

/**
 * Fill community cards to 5 cards, using unused cards.
 */
function fillCommunity(
  existing: string[],
  usedCards: Set<string>,
): string[] {
  const needed = 5 - existing.length;
  if (needed <= 0) return existing;
  const available: string[] = [];
  for (const rank of ALL_RANKS) {
    for (const suit of ALL_SUITS) {
      const card = rank + suit;
      if (!usedCards.has(card)) available.push(card);
    }
  }
  shuffle(available);
  return [...existing, ...available.slice(0, needed)];
}

const DEFAULT_SIMULATIONS = 2000;

/**
 * Calculate equity using Monte Carlo simulation.
 *
 * @param holeCards - Player's hole cards (2 cards, e.g. ["AS", "KH"])
 * @param communityCards - Known community cards (0–5 cards)
 * @param opponentCount - Number of opponents (default 1)
 * @param simulations - Number of MC iterations (default 2000)
 * @returns Equity as a percentage (0–100)
 */
export function calculateEquity(
  holeCards: string[],
  communityCards: string[],
  opponentCount: number = 1,
  simulations: number = DEFAULT_SIMULATIONS,
): number {
  if (holeCards.length !== 2) return 50;
  if (!isValidCard(holeCards[0]) || !isValidCard(holeCards[1])) return 50;

  const knownCommunity = communityCards.filter(isValidCard);

  let wins = 0;
  let ties = 0;

  for (let i = 0; i < simulations; i++) {
    // Collect all used cards so far
    const used = new Set<string>([...holeCards, ...knownCommunity]);

    // Opponent hole cards
    const opponentHoleCards: string[][] = [];
    for (let o = 0; o < opponentCount; o++) {
      opponentHoleCards.push(randomHand(used));
      opponentHoleCards[o].forEach((c) => used.add(c));
    }

    // Fill community if needed
    const fullCommunity = fillCommunity(knownCommunity, used);

    // Evaluate my hand
    const myScore = bestHandFrom(holeCards, fullCommunity);

    // Evaluate opponents
    let bestOpponentScore: HandScore | null = null;
    for (const oppCards of opponentHoleCards) {
      const oppScore = bestHandFrom(oppCards, fullCommunity);
      if (!bestOpponentScore || compareScores(oppScore, bestOpponentScore) > 0) {
        bestOpponentScore = oppScore;
      }
    }

    const compared = bestOpponentScore ? compareScores(myScore, bestOpponentScore) : 1;
    if (compared > 0) {
      wins++;
    } else if (compared === 0) {
      ties++;
    }
  }

  const total = simulations;
  // Equity = (wins + ties * 0.5) / total * 100
  return Math.round(((wins + ties * 0.5) / total) * 100);
}
