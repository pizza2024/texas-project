const RANK_VALUES: Record<string, number> = {
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

export const HAND_NAMES: Record<number, string> = {
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

export interface HandScore {
  rank: number; // 1–10
  values: number[]; // tiebreaker values, high to low
  name: string;
  bestCards: string[];
}

function parseRank(card: string): number {
  return RANK_VALUES[card.slice(0, -1)];
}

function parseSuit(card: string): string {
  return card.slice(-1);
}

export function evaluate5(cards: string[]): HandScore {
  const ranks = cards.map(parseRank).sort((a, b) => b - a);
  const suits = cards.map(parseSuit);

  const rankCount = new Map<number, number>();
  for (const r of ranks) rankCount.set(r, (rankCount.get(r) ?? 0) + 1);

  // Sort by group size desc, then rank desc
  const groups = [...rankCount.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0],
  );
  const counts = groups.map((g) => g[1]);
  const groupRanks = groups.map((g) => g[0]);

  const isFlush = suits.length >= 5 && new Set(suits).size === 1;

  // Straight detection
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[0];
    }
    // Ace-low straight: A-2-3-4-5 (wheel)
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
    return {
      rank: handRank,
      values: [straightHigh],
      name: HAND_NAMES[handRank],
      bestCards: cards,
    };
  }
  if (counts[0] === 4) {
    return {
      rank: 8,
      values: [groupRanks[0], groupRanks[1]],
      name: HAND_NAMES[8],
      bestCards: cards,
    };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    return {
      rank: 7,
      values: [groupRanks[0], groupRanks[1]],
      name: HAND_NAMES[7],
      bestCards: cards,
    };
  }
  if (isFlush) {
    return { rank: 6, values: ranks, name: HAND_NAMES[6], bestCards: cards };
  }
  if (isStraight) {
    return {
      rank: 5,
      values: [straightHigh],
      name: HAND_NAMES[5],
      bestCards: cards,
    };
  }
  if (counts[0] === 3) {
    return {
      rank: 4,
      values: groupRanks,
      name: HAND_NAMES[4],
      bestCards: cards,
    };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    // Two pair: values = [highPair, lowPair, kicker]
    const kicker = ranks.filter(
      (r) => r !== groupRanks[0] && r !== groupRanks[1],
    )[0];
    return {
      rank: 3,
      values: [groupRanks[0], groupRanks[1], kicker],
      name: HAND_NAMES[3],
      bestCards: cards,
    };
  }
  if (counts[0] === 2) {
    // Pair: values = [pairRank, kicker1, kicker2, kicker3]
    return {
      rank: 2,
      values: groupRanks,
      name: HAND_NAMES[2],
      bestCards: cards,
    };
  }
  return { rank: 1, values: ranks, name: HAND_NAMES[1], bestCards: cards };
}

export function compareScores(a: HandScore, b: HandScore): number {
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

/** Pick the best 5-card hand from hole cards + community cards. */
export function bestHandFrom(
  holeCards: string[],
  communityCards: string[],
): HandScore {
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

export interface PlayerHandResult {
  playerId: string;
  nickname: string;
  score: HandScore;
}

export function determineWinners(
  players: { id: string; nickname: string; cards: string[] }[],
  communityCards: string[],
): { winners: PlayerHandResult[]; all: PlayerHandResult[] } {
  const results: PlayerHandResult[] = players.map((p) => ({
    playerId: p.id,
    nickname: p.nickname,
    score: bestHandFrom(p.cards, communityCards),
  }));

  let bestScore = results[0].score;
  for (const r of results) {
    if (compareScores(r.score, bestScore) > 0) bestScore = r.score;
  }

  const winners = results.filter(
    (r) => compareScores(r.score, bestScore) === 0,
  );
  return { winners, all: results };
}
