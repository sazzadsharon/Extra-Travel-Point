import { calculatePrice, nightsBetween, datesInRange } from '../src/utils/pricing';

describe('STEP 7 — Hotel Pricing Service', () => {
  describe('calculatePrice core', () => {
    it('computes single-night base', () => {
      const r = calculatePrice({ basePrice: 1500, nights: 1 });
      expect(r.baseAmount).toBe(1500);
      expect(r.finalAmount).toBe(1500);
    });

    it('computes multi-night base', () => {
      const r = calculatePrice({ basePrice: 1500, nights: 3 });
      expect(r.baseAmount).toBe(4500);
    });

    it('applies taxes after base', () => {
      const r = calculatePrice({ basePrice: 1000, nights: 2, taxRate: 5 });
      expect(r.taxAmount).toBe(100);
      expect(r.finalAmount).toBe(2100);
    });

    it('applies service fee rate + flat', () => {
      const r = calculatePrice({ basePrice: 2000, nights: 1, serviceFeeRate: 5, serviceFeeFlat: 50 });
      expect(r.serviceFee).toBe(150);
    });

    it('percentage discount reduces base amount', () => {
      const r = calculatePrice({
        basePrice: 5000, nights: 2, taxRate: 10,
        promotion: { discountType: 'percentage', discountValue: 20 }
      });
      expect(r.discountAmount).toBe(2000);
    });

    it('fixed discount cannot exceed base', () => {
      const r = calculatePrice({
        basePrice: 1000, nights: 1,
        promotion: { discountType: 'fixed', discountValue: 5000 }
      });
      expect(r.discountAmount).toBe(1000);
      expect(r.finalAmount).toBe(0);
    });

    it('ignores promotion if minNights not met', () => {
      const r = calculatePrice({
        basePrice: 1000, nights: 2,
        promotion: { discountType: 'percentage', discountValue: 50, minNights: 5 }
      });
      expect(r.discountAmount).toBe(0);
    });

    it('ignores promotion if minAmount not met', () => {
      const r = calculatePrice({
        basePrice: 1000, nights: 1,
        promotion: { discountType: 'percentage', discountValue: 50, minAmount: 5000 }
      });
      expect(r.discountAmount).toBe(0);
    });

    it('rounds to 2 decimals avoiding float drift', () => {
      const r = calculatePrice({ basePrice: 333.33, nights: 3, taxRate: 5 });
      // 999.99 + 50.00 ≈ 1049.99 (within rounding)
      expect(Number.isInteger(r.finalAmount * 100) || Math.abs(r.finalAmount * 100 - Math.round(r.finalAmount * 100)) < 0.0001).toBe(true);
    });

    it('returns transparent lines', () => {
      const r = calculatePrice({ basePrice: 1000, nights: 2, taxRate: 10, promotion: { discountType: 'percentage', discountValue: 10 } });
      expect(r.lines.length).toBeGreaterThanOrEqual(3);
      expect(r.lines.some(l => l.label.includes('Tax'))).toBe(true);
      expect(r.lines.some(l => l.label === 'Discount')).toBe(true);
    });
  });

  describe('nightsBetween + datesInRange', () => {
    it('returns 1 night for same day after normalization', () => {
      const a = new Date('2026-01-15T18:00:00Z');
      const b = new Date('2026-01-16T02:00:00Z');
      expect(nightsBetween(a, b)).toBe(1);
    });

    it('returns 3 nights for 3-day range', () => {
      const a = new Date('2026-01-15T00:00:00Z');
      const b = new Date('2026-01-18T00:00:00Z');
      expect(nightsBetween(a, b)).toBe(3);
    });

    it('returns 1 night minimum even if same day', () => {
      const a = new Date('2026-01-15T00:00:00Z');
      const b = new Date('2026-01-15T00:00:00Z');
      expect(nightsBetween(a, b)).toBe(1);
    });

    it('datesInRange excludes checkout date', () => {
      const a = new Date(2026, 0, 15, 0, 0, 0); // local time Jan 15
      const b = new Date(2026, 0, 17, 0, 0, 0);
      const dates = datesInRange(a, b);
      expect(dates.length).toBe(2);
      expect(dates[0].getDate()).toBe(15);
      expect(dates[1].getDate()).toBe(16);
    });
  });
});
