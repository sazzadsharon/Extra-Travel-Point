export interface PricingBreakdownLine {
  label: string;
  amount: number;
  meta?: Record<string, unknown>;
}

export interface PricingBreakdown {
  baseAmount: number;
  nights: number;
  nightlyRate: number;
  taxAmount: number;
  serviceFee: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  lines: PricingBreakdownLine[];
}

export interface PricingInput {
  basePrice: number;
  nights: number;
  currency?: string;
  promotion?: {
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minNights?: number;
    minAmount?: number;
  } | null;
  taxRate?: number;
  serviceFeeRate?: number;
  serviceFeeFlat?: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculatePrice(input: PricingInput): PricingBreakdown {
  const nights = Math.max(1, Math.floor(input.nights || 1));
  const currency = input.currency || 'BDT';
  const baseAmount = round2(input.basePrice * nights);
  const taxRate = input.taxRate ?? 0;
  const serviceFeeRate = input.serviceFeeRate ?? 0;
  const serviceFeeFlat = input.serviceFeeFlat ?? 0;

  const taxAmount = round2((baseAmount * taxRate) / 100);
  const serviceFee = round2((baseAmount * serviceFeeRate) / 100 + serviceFeeFlat);

  let discountAmount = 0;
  if (input.promotion) {
    const meetsMinNights = !input.promotion.minNights || nights >= input.promotion.minNights;
    const meetsMinAmount = !input.promotion.minAmount || baseAmount >= input.promotion.minAmount;
    if (meetsMinNights && meetsMinAmount) {
      if (input.promotion.discountType === 'percentage') {
        discountAmount = round2((baseAmount * input.promotion.discountValue) / 100);
      } else {
        discountAmount = round2(Math.min(input.promotion.discountValue, baseAmount));
      }
    }
  }

  const finalAmount = round2(Math.max(0, baseAmount + taxAmount + serviceFee - discountAmount));

  const lines: PricingBreakdownLine[] = [
    { label: `Room × ${nights} night${nights > 1 ? 's' : ''}`, amount: baseAmount, meta: { nightlyRate: input.basePrice } }
  ];
  if (taxAmount > 0) lines.push({ label: `Tax (${taxRate}%)`, amount: taxAmount });
  if (serviceFee > 0) lines.push({ label: 'Service fee', amount: serviceFee });
  if (discountAmount > 0) lines.push({ label: 'Discount', amount: -discountAmount });

  return {
    baseAmount,
    nights,
    nightlyRate: input.basePrice,
    taxAmount,
    serviceFee,
    discountAmount,
    finalAmount,
    currency,
    lines
  };
}

export function datesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const curr = new Date(startDate);
  curr.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (curr < end) {
    dates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const a = new Date(checkIn);
  a.setHours(0, 0, 0, 0);
  const b = new Date(checkOut);
  b.setHours(0, 0, 0, 0);
  const diff = b.getTime() - a.getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
}
