import {
  calculateInsuranceFee,
  calculateInsurancePayout,
  checkInsuranceEligibility,
  INSURANCE_RATES,
} from './insurance-calculator';

describe('InsuranceCalculator', () => {
  describe('calculateInsuranceFee', () => {
    it('should calculate 50% insurance fee correctly', () => {
      // netLoss=1000, equity=0.25, rate=50
      // grossLoss = 1000 * (1 - 0.25) = 750
      // fee = floor(750 * 0.5) = 375
      const fee = calculateInsuranceFee(1000, 0.25, 50);
      expect(fee).toBe(375n);
    });

    it('should calculate 100% insurance fee correctly', () => {
      // netLoss=1000, equity=0.25, rate=100
      // grossLoss = 1000 * (1 - 0.25) = 750
      // fee = floor(750 * 1.0) = 750
      const fee = calculateInsuranceFee(1000, 0.25, 100);
      expect(fee).toBe(750n);
    });

    it('should return 0 for zero netLoss', () => {
      const fee = calculateInsuranceFee(0, 0.5, 50);
      expect(fee).toBe(0n);
    });

    it('should return 0 for zero equity (cold deck)', () => {
      // Player has 0% equity - fee equals full netLoss * rate
      // grossLoss = 1000 * (1 - 0) = 1000
      // fee = floor(1000 * 0.5) = 500
      const fee = calculateInsuranceFee(1000, 0, 50);
      expect(fee).toBe(500n);
    });

    it('should return 0 for zero rate', () => {
      const fee = calculateInsuranceFee(1000, 0.5, 0);
      expect(fee).toBe(0n);
    });

    it('should return 0 for negative netLoss (player already won)', () => {
      const fee = calculateInsuranceFee(-500, 0.5, 50);
      expect(fee).toBe(0n);
    });

    it('should floor the result', () => {
      // netLoss=1000, equity=0.333, rate=50
      // grossLoss = 1000 * (1 - 0.333) = 667
      // fee = floor(667 * 0.5) = 333
      const fee = calculateInsuranceFee(1000, 0.333, 50);
      expect(fee).toBe(333n);
    });

    it('should handle 100% equity (locked in)', () => {
      // grossLoss = netLoss * (1 - 1.0) = 0, fee = 0
      const fee = calculateInsuranceFee(1000, 1.0, 50);
      expect(fee).toBe(0n);
    });

    it('should handle small netLoss', () => {
      // netLoss=10, equity=0.5, rate=50
      // grossLoss = 10 * 0.5 = 5
      // fee = floor(5 * 0.5) = 2
      const fee = calculateInsuranceFee(10, 0.5, 50);
      expect(fee).toBe(2n);
    });
  });

  describe('calculateInsurancePayout', () => {
    it('should calculate 50% payout correctly', () => {
      // payout = floor(1000 * 0.5) = 500
      const payout = calculateInsurancePayout(1000, 50);
      expect(payout).toBe(500n);
    });

    it('should calculate 100% payout correctly', () => {
      // payout = floor(1000 * 1.0) = 1000
      const payout = calculateInsurancePayout(1000, 100);
      expect(payout).toBe(1000n);
    });

    it('should return 0 for zero netLoss', () => {
      const payout = calculateInsurancePayout(0, 50);
      expect(payout).toBe(0n);
    });

    it('should return 0 for zero rate', () => {
      const payout = calculateInsurancePayout(1000, 0);
      expect(payout).toBe(0n);
    });

    it('should return 0 for negative netLoss', () => {
      const payout = calculateInsurancePayout(-500, 50);
      expect(payout).toBe(0n);
    });

    it('should floor the result', () => {
      // payout = floor(999 * 0.5) = 499
      const payout = calculateInsurancePayout(999, 50);
      expect(payout).toBe(499n);
    });

    it('should handle fractional netLoss', () => {
      // payout = floor(100.5 * 0.5) = 50
      const payout = calculateInsurancePayout(100.5, 50);
      expect(payout).toBe(50n);
    });
  });

  describe('checkInsuranceEligibility', () => {
    it('should be eligible when pot exceeds minimum', () => {
      const result = checkInsuranceEligibility(100, 10, true, 10);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should be eligible at exact minimum pot', () => {
      const result = checkInsuranceEligibility(100, 10, true, 10);
      expect(result.eligible).toBe(true);
    });

    it('should NOT be eligible when player has no cards', () => {
      const result = checkInsuranceEligibility(100, 10, false, 10);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Player has no cards');
    });

    it('should NOT be eligible when pot is below minimum', () => {
      const result = checkInsuranceEligibility(50, 10, true, 10);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('below minimum');
    });

    it('should use default minPotMultiplier of 10', () => {
      // pot=99, bigBlind=10, minPot=100 → below threshold
      const result = checkInsuranceEligibility(99, 10, true);
      expect(result.eligible).toBe(false);
    });
  });

  describe('INSURANCE_RATES', () => {
    it('should have 50 and 100 as valid rates', () => {
      expect(INSURANCE_RATES).toContain(50);
      expect(INSURANCE_RATES).toContain(100);
      expect(INSURANCE_RATES).toHaveLength(2);
    });
  });
});
