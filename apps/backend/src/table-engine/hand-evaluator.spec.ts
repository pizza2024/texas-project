import {
  evaluate5,
  evaluateHand,
  bestHandFrom,
  compareScores,
  HAND_NAMES,
} from './hand-evaluator';

describe('HAND_NAMES', () => {
  it('has all 10 hand rank names', () => {
    expect(HAND_NAMES[1]).toBe('高牌');
    expect(HAND_NAMES[2]).toBe('一对');
    expect(HAND_NAMES[3]).toBe('两对');
    expect(HAND_NAMES[4]).toBe('三条');
    expect(HAND_NAMES[5]).toBe('顺子');
    expect(HAND_NAMES[6]).toBe('同花');
    expect(HAND_NAMES[7]).toBe('葫芦');
    expect(HAND_NAMES[8]).toBe('四条');
    expect(HAND_NAMES[9]).toBe('同花顺');
    expect(HAND_NAMES[10]).toBe('皇家同花顺');
  });
});

// ============================================================
// Tests for evaluate5 / bestHandFrom (HEAD version)
// ============================================================
describe('evaluate5 - Hand Rankings', () => {
  describe('高牌 (High Card)', () => {
    it('recognizes high card', () => {
      const score = evaluate5(['AS', 'KH', 'QD', 'JC', '2S']);
      expect(score.rank).toBe(1);
      expect(score.name).toBe(HAND_NAMES[1]);
      expect(score.values).toEqual([14, 13, 12, 11, 2]);
    });
  });

  describe('一对 (One Pair)', () => {
    it('recognizes one pair', () => {
      const score = evaluate5(['AS', 'AH', 'QD', 'JC', '2S']);
      expect(score.rank).toBe(2);
      expect(score.name).toBe(HAND_NAMES[2]);
      expect(score.values[0]).toBe(14); // Pair of Aces
    });

    it('compares pairs correctly: A pair beats K pair', () => {
      const pairA = evaluate5(['AS', 'AH', 'QD', 'JC', '2S']);
      const pairK = evaluate5(['KS', 'KH', 'QD', 'JC', '2S']);
      expect(compareScores(pairA, pairK)).toBeGreaterThan(0);
    });
  });

  describe('两对 (Two Pair)', () => {
    it('recognizes two pair', () => {
      const score = evaluate5(['AS', 'AH', 'KS', 'KH', 'QD']);
      expect(score.rank).toBe(3);
      expect(score.name).toBe(HAND_NAMES[3]);
      expect(score.values).toEqual([14, 13, 12]); // Aces over Kings, kicker Q
    });

    it('two pair A-A-K-K beats Q-Q-J-J', () => {
      const aaKK = evaluate5(['AS', 'AH', 'KS', 'KH', '2D']);
      const qqjj = evaluate5(['QS', 'QH', 'JS', 'JH', '2D']);
      expect(compareScores(aaKK, qqjj)).toBeGreaterThan(0);
    });

    it('kicker decides two pair tie', () => {
      const with5 = evaluate5(['AS', 'AH', 'KS', 'KH', '5D']);
      const with2 = evaluate5(['AS', 'AH', 'KS', 'KH', '2D']);
      expect(compareScores(with5, with2)).toBeGreaterThan(0);
    });
  });

  describe('三条 (Three of a Kind)', () => {
    it('recognizes three of a kind', () => {
      const score = evaluate5(['AS', 'AH', 'AD', 'KC', 'QS']);
      expect(score.rank).toBe(4);
      expect(score.name).toBe(HAND_NAMES[4]);
    });
  });

  describe('顺子 (Straight)', () => {
    it('recognizes broadway straight (A-K-Q-J-T)', () => {
      const score = evaluate5(['AS', 'KH', 'QD', 'JC', 'TS']);
      expect(score.rank).toBe(5);
      expect(score.name).toBe(HAND_NAMES[5]);
      expect(score.values[0]).toBe(14); // Ace-high
    });

    it('recognizes wheel straight (A-2-3-4-5)', () => {
      const score = evaluate5(['AS', '2H', '3D', '4C', '5S']);
      expect(score.rank).toBe(5);
      expect(score.name).toBe(HAND_NAMES[5]);
      expect(score.values[0]).toBe(5); // Wheel is high-5
    });

    it('recognizes mid straight', () => {
      const score = evaluate5(['6S', '7H', '8D', '9C', 'TS']);
      expect(score.rank).toBe(5);
      expect(score.values[0]).toBe(10);
    });
  });

  describe('同花 (Flush)', () => {
    it('recognizes flush', () => {
      const score = evaluate5(['AH', 'KH', 'QH', 'JH', '2H']);
      expect(score.rank).toBe(6);
      expect(score.name).toBe(HAND_NAMES[6]);
    });
  });

  describe('葫芦 (Full House)', () => {
    it('recognizes full house', () => {
      const score = evaluate5(['AS', 'AH', 'AD', 'KS', 'KH']);
      expect(score.rank).toBe(7);
      expect(score.name).toBe(HAND_NAMES[7]);
    });

    it('A-A-A-K-K beats K-K-K-Q-Q', () => {
      const aaaKK = evaluate5(['AS', 'AH', 'AD', 'KS', 'KH']);
      const kkkQQ = evaluate5(['KS', 'KH', 'KD', 'QS', 'QH']);
      expect(compareScores(aaaKK, kkkQQ)).toBeGreaterThan(0);
    });
  });

  describe('四条 (Four of a Kind)', () => {
    it('recognizes four of a kind', () => {
      const score = evaluate5(['AS', 'AH', 'AD', 'AC', 'KS']);
      expect(score.rank).toBe(8);
      expect(score.name).toBe(HAND_NAMES[8]);
    });
  });

  describe('同花顺 (Straight Flush)', () => {
    it('recognizes straight flush', () => {
      const score = evaluate5(['9H', 'TH', 'JH', 'QH', 'KH']);
      expect(score.rank).toBe(9);
      expect(score.name).toBe(HAND_NAMES[9]);
    });

    it('royal flush is rank 10', () => {
      const score = evaluate5(['TH', 'JH', 'QH', 'KH', 'AH']);
      expect(score.rank).toBe(10);
      expect(score.name).toBe(HAND_NAMES[10]);
    });

    it('royal flush beats straight flush', () => {
      const royal = evaluate5(['TH', 'JH', 'QH', 'KH', 'AH']);
      const sf = evaluate5(['9H', 'TH', 'JH', 'QH', 'KH']);
      expect(compareScores(royal, sf)).toBeGreaterThan(0);
    });
  });
});

describe('bestHandFrom - 7-card best hand', () => {
  it('picks best 5 from 7 cards', () => {
    const hole = ['2H', '3H'];
    const community = ['TH', 'JH', 'QH', 'KH', 'AH', '2D', '3S'];
    const score = bestHandFrom(hole, community);
    // Should find royal flush (7 hearts → T-J-Q-K-A of hearts)
    expect(score.rank).toBe(10);
  });

  it('returns high card when no made hand', () => {
    const hole = ['AS', '2D'];
    const community = ['5H', '9C', 'JD'];
    const score = bestHandFrom(hole, community);
    expect(score.rank).toBe(1);
  });
});

// ============================================================
// Tests for evaluateHand (Remote version - 04a7a0d)
// ============================================================
describe('evaluateHand - Hand Rankings', () => {
  describe('Royal Flush', () => {
    it('detects royal flush (A-K-Q-J-T same suit)', () => {
      const score = evaluateHand(['AS', 'KS', 'QS', 'JS', 'TS']);
      expect(score.rank).toBe(10);
      expect(score.name).toBe('皇家同花顺');
    });
  });

  describe('Straight Flush', () => {
    it('detects straight flush (9-high)', () => {
      const score = evaluateHand(['9H', '8H', '7H', '6H', '5H']);
      expect(score.rank).toBe(9);
      expect(score.name).toBe('同花顺');
      expect(score.values).toContain(9);
    });

    it('detects straight flush (Ace-low wheel)', () => {
      const score = evaluateHand(['AH', '2H', '3H', '4H', '5H']);
      expect(score.rank).toBe(9);
      expect(score.name).toBe('同花顺');
      expect(score.values).toEqual([5]); // wheel straight high is 5
    });
  });

  describe('Four of a Kind', () => {
    it('detects four of a kind', () => {
      const score = evaluateHand(['AH', 'AD', 'AC', 'AS', '2S']);
      expect(score.rank).toBe(8);
      expect(score.name).toBe('四条');
      expect(score.values[0]).toBe(14); // Aces
      expect(score.values[1]).toBe(2); // kicker
    });

    it('four of a kind with different rank kicker', () => {
      const score = evaluateHand(['7H', '7D', '7C', '7S', 'KH']);
      expect(score.rank).toBe(8);
      expect(score.values[0]).toBe(7);
      expect(score.values[1]).toBe(13); // kicker K
    });
  });

  describe('Full House', () => {
    it('detects full house (Aces over Kings)', () => {
      const score = evaluateHand(['AH', 'AD', 'AC', 'KH', 'KD']);
      expect(score.rank).toBe(7);
      expect(score.name).toBe('葫芦');
      expect(score.values[0]).toBe(14); // three Aces
      expect(score.values[1]).toBe(13); // two Kings
    });

    it('detects full house (lower trips)', () => {
      const score = evaluateHand(['2H', '2D', '2S', 'AH', 'AD']);
      expect(score.rank).toBe(7);
      expect(score.values[0]).toBe(2); // three 2s
      expect(score.values[1]).toBe(14); // two Aces
    });
  });

  describe('Flush (non-straight)', () => {
    it('detects flush in one suit', () => {
      const score = evaluateHand(['2H', '5H', '9H', 'JH', 'KH']);
      expect(score.rank).toBe(6);
      expect(score.name).toBe('同花');
      expect(score.values).toEqual([13, 11, 9, 5, 2]);
    });

    it('flush is not confused with straight flush', () => {
      const flushScore = evaluateHand(['2H', '5H', '9H', 'JH', 'KH']);
      const straightFlushScore = evaluateHand(['9H', '8H', '7H', '6H', '5H']);
      expect(flushScore.rank).toBeLessThan(straightFlushScore.rank);
    });
  });

  describe('Straight (non-flush)', () => {
    it('detects straight (broadway)', () => {
      const score = evaluateHand(['AH', 'KH', 'QD', 'JS', 'TC']);
      expect(score.rank).toBe(5);
      expect(score.name).toBe('顺子');
      expect(score.values).toEqual([14]); // Ace-high
    });

    it('detects straight (mid)', () => {
      const score = evaluateHand(['7H', '8D', '9S', 'TC', 'JH']);
      expect(score.rank).toBe(5);
      expect(score.values).toEqual([11]); // J-high
    });

    it('straight is not confused with flush', () => {
      const straightScore = evaluateHand(['7H', '8D', '9S', 'TC', 'JH']);
      const flushScore = evaluateHand(['2H', '5H', '9H', 'JH', 'KH']);
      expect(straightScore.rank).toBeLessThan(flushScore.rank);
    });
  });

  describe('Ace-low Straight (Wheel A-2-3-4-5)', () => {
    it('detects wheel straight', () => {
      const score = evaluateHand(['AH', '2D', '3S', '4C', '5H']);
      expect(score.rank).toBe(5);
      expect(score.name).toBe('顺子');
      expect(score.values).toEqual([5]); // wheel high card is 5
    });

    it('wheel (5-high) loses to 6-high straight', () => {
      const wheel = evaluateHand(['AH', '2D', '3S', '4C', '5H']);
      const sixHigh = evaluateHand(['6H', '7D', '8S', '9C', 'TH']);
      expect(compareScores(wheel, sixHigh)).toBeLessThan(0);
    });

    it('wheel straight loses to higher straights', () => {
      const wheel = evaluateHand(['AH', '2D', '3S', '4C', '5H']);
      const nineHigh = evaluateHand(['9H', 'TD', 'JS', 'QC', 'KH']);
      expect(compareScores(wheel, nineHigh)).toBeLessThan(0);
    });

    it('comparing two wheels returns 0', () => {
      const w1 = evaluateHand(['AH', '2D', '3S', '4C', '5H']);
      const w2 = evaluateHand(['AS', '2H', '3D', '4S', '5D']);
      expect(compareScores(w1, w2)).toBe(0);
    });
  });

  describe('Three of a Kind', () => {
    it('detects three of a kind', () => {
      const score = evaluateHand(['AH', 'AD', 'AC', '2S', '5H']);
      expect(score.rank).toBe(4);
      expect(score.name).toBe('三条');
      expect(score.values[0]).toBe(14); // trip Aces
    });

    it('three of a kind vs kickers sorted correctly', () => {
      const score = evaluateHand(['TH', 'TD', 'TS', '2C', '5H']);
      expect(score.values).toEqual([10, 5, 2]); // Tens first, then kickers high to low
    });
  });

  describe('Two Pair', () => {
    it('detects two pair', () => {
      const score = evaluateHand(['AH', 'AD', '2S', '2C', '5H']);
      expect(score.rank).toBe(3);
      expect(score.name).toBe('两对');
      expect(score.values[0]).toBe(14); // higher pair Aces
      expect(score.values[1]).toBe(2); // lower pair 2s
    });

    it('two pair ordering: top pair wins', () => {
      const score1 = evaluateHand(['KH', 'KD', '2S', '2C', '5H']);
      const score2 = evaluateHand(['AH', 'AD', '2S', '2C', '5H']);
      expect(compareScores(score2, score1)).toBeGreaterThan(0);
    });

    it('two pair with same pairs, different kicker', () => {
      const withKing = evaluateHand(['AH', 'AD', 'KS', 'KC', '2H']);
      const withQueen = evaluateHand(['AH', 'AD', 'QS', 'QC', '2H']);
      expect(compareScores(withKing, withQueen)).toBeGreaterThan(0);
    });
  });

  describe('One Pair', () => {
    it('detects one pair', () => {
      const score = evaluateHand(['AH', 'AD', '2S', '3C', '5H']);
      expect(score.rank).toBe(2);
      expect(score.name).toBe('一对');
      expect(score.values[0]).toBe(14); // pair Aces
    });

    it('higher pair beats lower pair', () => {
      const pairAces = evaluateHand(['AH', 'AD', '2S', '3C', '5H']);
      const pairKings = evaluateHand(['KH', 'KD', '2S', '3C', '5H']);
      expect(compareScores(pairAces, pairKings)).toBeGreaterThan(0);
    });

    it('same pair: kickers break tie', () => {
      const highKicker = evaluateHand(['AH', 'AD', 'KS', 'QC', '2H']);
      const lowKicker = evaluateHand(['AH', 'AD', 'JS', 'TC', '2H']);
      expect(compareScores(highKicker, lowKicker)).toBeGreaterThan(0);
    });
  });

  describe('High Card', () => {
    it('detects high card', () => {
      const score = evaluateHand(['2H', '5D', '8S', 'JC', 'KH']);
      expect(score.rank).toBe(1);
      expect(score.name).toBe('高牌');
      expect(score.values).toEqual([13, 11, 8, 5, 2]);
    });

    it('high card Ace-high beats King-high', () => {
      const aceHigh = evaluateHand(['AH', 'KD', 'QS', 'JH', '5C']);
      const kingHigh = evaluateHand(['KH', 'QD', 'JS', '9C', '8H']);
      expect(compareScores(aceHigh, kingHigh)).toBeGreaterThan(0);
    });
  });
});

describe('compareScores', () => {
  it('returns positive when a > b', () => {
    const flush = evaluate5(['AH', 'KH', 'QH', 'JH', '2H']);
    const straight = evaluate5(['6S', '7H', '8D', '9C', 'TS']);
    expect(compareScores(flush, straight)).toBeGreaterThan(0);
  });

  it('returns negative when a < b', () => {
    const straight = evaluateHand(['7H', '8D', '9S', 'TC', 'JH']);
    const flush = evaluateHand(['2H', '5H', '9H', 'JH', 'KH']);
    expect(compareScores(straight, flush)).toBeLessThan(0);
  });

  it('returns 0 for equal hands', () => {
    const h1 = evaluate5(['AH', 'KH', 'QH', 'JH', 'TH']);
    const h2 = evaluate5(['AD', 'KD', 'QD', 'JD', 'TD']);
    expect(compareScores(h1, h2)).toBe(0);
  });

  it('ranks higher hand type beats lower regardless of values', () => {
    const royal = evaluateHand(['AS', 'KS', 'QS', 'JS', 'TS']);
    const sflush = evaluateHand(['9H', '8H', '7H', '6H', '5H']);
    expect(compareScores(royal, sflush)).toBeGreaterThan(0);
    expect(
      compareScores(sflush, evaluateHand(['AH', 'AD', 'AC', 'AS', '2S'])),
    ).toBeGreaterThan(0);
  });

  it('same rank: first tiebreaker value decides', () => {
    const higherTrip = evaluateHand(['AH', 'AD', 'AC', '2S', '3H']);
    const lowerTrip = evaluateHand(['KH', 'KD', 'KC', '2S', '3H']);
    expect(compareScores(higherTrip, lowerTrip)).toBeGreaterThan(0);
  });

  it('equal hands including tiebreakers returns 0', () => {
    const h1 = evaluateHand(['AH', 'AD', 'AC', '2S', '3H']);
    const h2 = evaluateHand(['AH', 'AD', 'AC', '2S', '3H']);
    expect(compareScores(h1, h2)).toBe(0);
  });

  it('flush vs flush: higher kicker wins', () => {
    const higherFlush = evaluateHand(['2H', '5H', '9H', 'JH', 'KH']);
    const lowerFlush = evaluateHand(['2D', '4D', '7D', '9D', 'TD']);
    expect(compareScores(higherFlush, lowerFlush)).toBeGreaterThan(0);
  });
});

describe('evaluateHand – 7 cards (best-5 selection)', () => {
  it('selects best 5 from 7 cards (royal flush in community)', () => {
    const score = evaluateHand(['AS', 'KS', 'QS', 'JS', 'TS', '2H', '3D']);
    expect(score.rank).toBe(10);
    expect(score.name).toBe('皇家同花顺');
  });

  it('selects best 5 from 7 cards (straight flush)', () => {
    const score = evaluateHand(['9H', '8H', '7H', '6H', '5H', 'AH', 'KH']);
    expect(score.rank).toBe(9);
    expect(score.name).toBe('同花顺');
  });

  it('selects best 5 from 7 cards (four of a kind from quads)', () => {
    const score = evaluateHand(['AH', 'AD', 'AC', 'AS', '2H', '3D', '4S']);
    expect(score.rank).toBe(8);
    expect(score.name).toBe('四条');
    expect(score.values[0]).toBe(14);
    expect(score.values[1]).toBe(4); // highest kicker among remaining cards
  });

  it('selects best 5 from 7 cards (full house from trips + pair)', () => {
    const score = evaluateHand(['AH', 'AD', 'AC', 'KH', 'KD', '2S', '3C']);
    expect(score.rank).toBe(7);
    expect(score.name).toBe('葫芦');
    expect(score.values[0]).toBe(14); // trips Aces
    expect(score.values[1]).toBe(13); // pair Kings
  });

  it('prefers flush over lower straights when 7 cards contain both', () => {
    const score = evaluateHand(['2H', '5H', '9H', 'JH', 'KH', '7D', '8S']);
    expect(score.rank).toBe(6);
    expect(score.name).toBe('同花');
  });

  it('prefers straight over three of a kind from 7 cards', () => {
    const score = evaluateHand(['7H', '8D', '9S', 'TC', 'JH', '7C', '7D']);
    expect(score.rank).toBe(5);
    expect(score.name).toBe('顺子');
  });

  it('prefers full house over three of a kind from 7 cards', () => {
    const score = evaluateHand(['AH', 'AD', '7S', '7D', '7C', '2H', '3D']);
    expect(score.rank).toBe(7);
    expect(score.name).toBe('葫芦');
  });

  it('selects two pair best combination from 7 cards', () => {
    const score = evaluateHand(['AH', 'AD', 'KH', 'KD', 'QS', '2C', '3H']);
    expect(score.rank).toBe(3);
    expect(score.name).toBe('两对');
    expect(score.values[0]).toBe(14);
    expect(score.values[1]).toBe(13);
  });

  it('selects one pair from 7 cards when no better hand possible', () => {
    const score = evaluateHand(['AH', 'AD', '2S', '3C', '4H', '6D', '7S']);
    expect(score.rank).toBe(2);
    expect(score.name).toBe('一对');
    expect(score.values[0]).toBe(14);
  });

  it('selects high card from 7 cards with no made hand', () => {
    const score = evaluateHand(['2H', '5D', '8S', 'JC', 'KH', '3C', '7S']);
    expect(score.rank).toBe(1);
    expect(score.name).toBe('高牌');
    expect(score.values[0]).toBe(13); // K high
  });

  it('selects wheel (A-2-3-4-5) as best straight from 7 cards', () => {
    const score = evaluateHand(['AH', '2D', '3S', '4C', '5H', 'KH', 'QD']);
    expect(score.rank).toBe(5);
    expect(score.values).toEqual([5]); // wheel
  });

  it('selects broadway (10-J-Q-K-A) as best straight from 7 cards', () => {
    const score = evaluateHand(['AH', 'KH', 'QD', 'JS', 'TC', '2D', '3S']);
    expect(score.rank).toBe(5);
    expect(score.values).toEqual([14]); // broadway
  });

  it('prefers flush over straight from 7 cards', () => {
    const score = evaluateHand(['2H', '5H', '9H', 'JH', 'KH', '6D', '7S']);
    expect(score.rank).toBe(6);
    expect(score.name).toBe('同花');
  });
});

describe('evaluateHand – 6 cards (best-5 selection)', () => {
  it('selects best 5 from 6 cards (flush)', () => {
    const score = evaluateHand(['2H', '5H', '9H', 'JH', 'KH', '3D']);
    expect(score.rank).toBe(6);
    expect(score.name).toBe('同花');
  });

  it('selects best 5 from 6 cards (straight)', () => {
    const score = evaluateHand(['7H', '8D', '9S', 'TC', 'JH', '2C']);
    expect(score.rank).toBe(5);
    expect(score.name).toBe('顺子');
  });

  it('prefers full house over flush in 6 cards', () => {
    const score = evaluateHand(['AH', 'AD', 'AC', 'KH', 'KD', '2S']);
    expect(score.rank).toBe(7);
    expect(score.name).toBe('葫芦');
  });
});

describe('evaluateHand – edge cases', () => {
  it('throws for fewer than 5 cards', () => {
    expect(() => evaluateHand(['AH', 'KD', 'QS'])).toThrow();
  });

  it('throws for more than 7 cards', () => {
    expect(() =>
      evaluateHand(['AH', 'KD', 'QS', 'JS', 'TS', '2H', '3D', '4S']),
    ).toThrow();
  });

  it('accepts exactly 5 cards', () => {
    const score = evaluateHand(['2H', '3D', '4S', '5C', '6H']);
    expect(score.rank).toBe(5);
    expect(score.name).toBe('顺子');
  });

  it('accepts exactly 6 cards', () => {
    const score = evaluateHand(['2H', '5H', '9H', 'JH', 'KH', '3D']);
    expect(score.rank).toBe(6);
  });

  it('accepts exactly 7 cards', () => {
    const score = evaluateHand(['AS', 'KS', 'QS', 'JS', 'TS', '2H', '3D']);
    expect(score.rank).toBe(10);
  });

  it('4-of-a-kind: four 7s beats four 5s', () => {
    const sevens = evaluateHand(['7H', '7D', '7C', '7S', '2H']);
    const fives = evaluateHand(['5H', '5D', '5C', '5S', 'AH']);
    expect(compareScores(sevens, fives)).toBeGreaterThan(0);
  });

  it('same four of a kind: kicker decides', () => {
    const withKicker9 = evaluateHand(['7H', '7D', '7C', '7S', '9H']);
    const withKicker8 = evaluateHand(['7H', '7D', '7C', '7S', '8H']);
    expect(compareScores(withKicker9, withKicker8)).toBeGreaterThan(0);
  });
});
