/**
 * Centralized commission + settlement engine.
 *
 * Money values are stored as Float in the existing schema. To avoid
 * floating-point arithmetic bugs we round monetary results to 2 decimals.
 *
 * Idempotency: `Settlement.bookingId` is `@unique` in the Prisma schema,
 * so re-running the settlement creation for the same booking will never
 * produce a duplicate row. We also wrap the creation in a transaction.
 */
import { prisma } from '../prisma';

export const SETTLEMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid'
} as const;

export const PAYOUT_STATUS = {
  PAYOUT_REQUESTED: 'PAYOUT_REQUESTED',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
} as const;

export type PayoutStatus =
  (typeof PAYOUT_STATUS)[keyof typeof PAYOUT_STATUS];

export const PAYOUT_STATUSES: PayoutStatus[] = [
  PAYOUT_STATUS.PAYOUT_REQUESTED,
  PAYOUT_STATUS.PROCESSING,
  PAYOUT_STATUS.PAID,
  PAYOUT_STATUS.REJECTED,
  PAYOUT_STATUS.CANCELLED
];

export const PAYOUT_METHODS = ['BANK', 'BKASH', 'NAGAD', 'ROCKET'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  PAYOUT_REQUESTED: [PAYOUT_STATUS.PROCESSING, PAYOUT_STATUS.REJECTED, PAYOUT_STATUS.CANCELLED],
  PROCESSING: [PAYOUT_STATUS.PAID, PAYOUT_STATUS.REJECTED],
  PAID: [],
  REJECTED: [],
  CANCELLED: []
};

const DEFAULT_COMMISSION_RATE = 10.0;
const SYSTEM_SETTING_KEY = 'defaultCommissionRate';

export { DEFAULT_COMMISSION_RATE, SYSTEM_SETTING_KEY };

function round2(n: number): number {
  // Round to 2 decimals using integer arithmetic to avoid 0.1+0.2 issues.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface CommissionInput {
  grossAmount: number;
  commissionRate?: number | null;
}

export interface CommissionBreakdown {
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  vendorAmount: number;
  currency: string;
}

/**
 * Pure commission math. Does NOT touch the database. All values are
 * derived from server-side inputs only — never from the client.
 */
export function calculateCommission(input: CommissionInput): CommissionBreakdown {
  const gross = Number(input.grossAmount);
  if (!Number.isFinite(gross) || gross < 0) {
    throw new Error('grossAmount must be a non-negative finite number');
  }
  const rawRate = input.commissionRate;
  const rate =
    rawRate == null || !Number.isFinite(rawRate)
      ? DEFAULT_COMMISSION_RATE
      : Math.max(0, Math.min(100, rawRate));
  const commission = round2((gross * rate) / 100);
  const vendor = round2(gross - commission);
  return {
    grossAmount: round2(gross),
    commissionRate: rate,
    commissionAmount: commission,
    vendorAmount: vendor,
    currency: 'BDT'
  };
}

/**
 * Resolve the effective commission rate with priority:
 *   1. Service-specific rate
 *   2. Provider-specific rate
 *   3. System default (persisted in SystemSetting, fallback 10%)
 */
export async function resolveCommissionRate(opts: {
  serviceRate?: number | null;
  providerRate?: number | null;
} = {}): Promise<number> {
  const { serviceRate, providerRate } = opts;

  if (serviceRate != null && Number.isFinite(serviceRate)) {
    return Math.max(0, Math.min(100, serviceRate));
  }
  if (providerRate != null && Number.isFinite(providerRate)) {
    return Math.max(0, Math.min(100, providerRate));
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: SYSTEM_SETTING_KEY }
  });
  if (setting && setting.value.trim() !== '') {
    const parsed = parseFloat(setting.value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, parsed));
    }
  }

  return DEFAULT_COMMISSION_RATE;
}

/**
 * Create the financial Settlement ledger entry for a paid booking.
 *
 * - Idempotent via the unique Settlement.bookingId constraint.
 * - Only acts when booking has a serviceId (vendor-service bookings).
 *   Bus Bookings (no serviceId) are explicitly skipped so existing
 *   Bus Booking financial flows remain untouched.
 * - Returns null if the booking is not eligible (no serviceId).
 * - Returns the existing settlement if one already exists (idempotent).
 */
export interface EnsureSettlementResult {
  settlement: any;
  created: boolean;
  skipped?: 'no-service';
}

export async function ensureSettlementForPaidBooking(
  bookingId: number
): Promise<EnsureSettlementResult | null> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        service: true,
        settlement: true
      }
    });
    if (!booking) return null;

    if (booking.paymentStatus !== 'paid') return null;

    // Only vendor-service bookings generate commission entries.
    if (!booking.serviceId) {
      return { settlement: null, created: false, skipped: 'no-service' as const };
    }

    // Idempotent: if a settlement already exists, return it.
    const existing = await tx.settlement.findUnique({
      where: { bookingId }
    });
    if (existing) {
      return { settlement: existing, created: false };
    }

    const rate = await resolveCommissionRate({ providerRate: booking.provider?.commissionRate });
    const breakdown = calculateCommission({
      grossAmount: booking.finalAmount,
      commissionRate: rate
    });

    const created = await tx.settlement.create({
      data: {
        bookingId: booking.id,
        providerId: booking.providerId,
        serviceId: booking.serviceId,
        grossAmount: breakdown.grossAmount,
        commissionRate: breakdown.commissionRate,
        commissionAmount: breakdown.commissionAmount,
        netAmount: breakdown.vendorAmount,
        currency: breakdown.currency,
        status: SETTLEMENT_STATUS.PENDING
      }
    });

    return { settlement: created, created: true };
  });
}

/**
 * Compute vendor balance summary from the settlement ledger.
 * This is the authoritative balance — never derived from client input.
 */
export interface VendorBalance {
  currency: string;
  grossSales: number;
  commissionTotal: number;
  netEarnings: number;
  pendingBalance: number; // settlements not yet paid out
  paidOut: number;        // settlements whose linked payout is PAID
  availableBalance: number; // pending - sum of pending payout requests
  payoutRequested: number; // sum of PAYOUT_REQUESTED + PROCESSING payouts
}

export async function getVendorBalance(providerId: number): Promise<VendorBalance> {
  const [settlements, payouts] = await Promise.all([
    prisma.settlement.findMany({ where: { providerId } }),
    prisma.payoutRequest.findMany({
      where: {
        providerId,
        status: { in: [PAYOUT_STATUS.PAYOUT_REQUESTED, PAYOUT_STATUS.PROCESSING] }
      }
    })
  ]);

  let grossSales = 0;
  let commissionTotal = 0;
  let netEarnings = 0;
  let paidOut = 0;

  for (const s of settlements) {
    grossSales += s.grossAmount;
    commissionTotal += s.commissionAmount;
    netEarnings += s.netAmount;
    if (s.status === SETTLEMENT_STATUS.PAID) {
      paidOut += s.netAmount;
    }
  }

  const pendingBalance = round2(netEarnings - paidOut);
  const payoutRequested = round2(
    payouts.reduce((sum, p) => sum + p.amount, 0)
  );
  const availableBalance = round2(
    Math.max(0, pendingBalance - payoutRequested)
  );

  return {
    currency: 'BDT',
    grossSales: round2(grossSales),
    commissionTotal: round2(commissionTotal),
    netEarnings: round2(netEarnings),
    pendingBalance,
    paidOut: round2(paidOut),
    availableBalance,
    payoutRequested
  };
}

export { round2 };