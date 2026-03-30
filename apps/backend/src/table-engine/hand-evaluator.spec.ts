import {
  evaluate5,
  bestHandFrom,
  compareScores,
  HAND_NAMES,
} from './hand-evaluator';

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

describe('compareScores', () => {
  it('returns positive when a > b', () => {
    const flush = evaluate5(['AH', 'KH', 'QH', 'JH', '2H']);
    const straight = evaluate5(['6S', '7H', '8D', '9C', 'TS']);
    expect(compareScores(flush, straight)).toBeGreaterThan(0);
  });

  it('returns negative when a < b', () => {
    const flush = evaluate5(['AH', 'KH', 'QH', 'JH', '2H']);
    const straight = evaluate5(['6S', '7H', '8D', '9C', 'TS']);
    expect(compareScores(straight, flush)).toBeLessThan(0);
  });

  it('returns 0 for equal hands', () => {
    const h1 = evaluate5(['AH', 'KH', 'QH', 'JH', 'TH']);
    const h2 = evaluate5(['AD', 'KD', 'QD', 'JD', 'TD']);
    expect(compareScores(h1, h2)).toBe(0);
  });
});
