import { calculatePrice, datesInRange, nightsBetween } from '../src/utils/pricing';

describe('Hotel pricing service', () => {
  it('calculates base price for N nights with no extras', () => {
    const r = calculatePrice({ basePrice: 1000, nights: 3 });
    expect(r.nights).toBe(3);
    expect(r.baseAmount).toBe(3000);
    expect(r.taxAmount).toBe(0);
    expect(r.serviceFee).toBe(0);
    expect(r.discountAmount).toBe(0);
    expect(r.finalAmount).toBe(3000);
  });

  it('applies percentage discount and taxes', () => {
    const r = calculatePrice({
      basePrice: 1000,
      nights: 2,
      taxRate: 10,
      serviceFeeRate: 5,
      promotion: { discountType: 'percentage', discountValue: 10 }
    });
    expect(r.baseAmount).toBe(2000);
    expect(r.taxAmount).toBe(200);
    expect(r.serviceFee).toBe(100);
    expect(r.discountAmount).toBe(200);
    expect(r.finalAmount).toBe(2100);
  });

  it('respects minNights promotion condition', () => {
    const r = calculatePrice({
      basePrice: 1000,
      nights: 2,
      promotion: { discountType: 'percentage', discountValue: 50, minNights: 3 }
    });
    expect(r.discountAmount).toBe(0);
  });

  it('caps fixed discount at base amount', () => {
    const r = calculatePrice({
      basePrice: 1000,
      nights: 1,
      promotion: { discountType: 'fixed', discountValue: 5000 }
    });
    expect(r.discountAmount).toBe(1000);
    expect(r.finalAmount).toBe(0);
  });

  it('datesInRange returns N-1 nights for check-in to check-out', () => {
    const d = datesInRange(new Date('2026-09-10'), new Date('2026-09-13'));
    expect(d.length).toBe(3);
  });

  it('nightsBetween handles same-day and reversed ranges', () => {
    expect(nightsBetween(new Date('2026-09-10'), new Date('2026-09-12'))).toBe(2);
    expect(nightsBetween(new Date('2026-09-10'), new Date('2026-09-10'))).toBe(1);
    expect(nightsBetween(new Date('2026-09-10'), new Date('2026-09-09'))).toBe(1);
  });
});
