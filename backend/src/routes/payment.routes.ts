import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { z } from 'zod';
import crypto from 'crypto';
import { ensureSettlementForPaidBooking, resolveCommissionRate, DEFAULT_COMMISSION_RATE, round2 } from '../utils/commission';
import { expireHotelBookingIfNeeded } from '../utils/hotel-booking-expiry';
import { canTransitionHotelBooking } from '../utils/hotel-booking-state';
import { resolvePaymentGateway, PaymentGatewayConfig } from '../utils/payment-gateways';
import { logWarn } from '../utils/logger';

const router = Router();

const paymentInitiateSchema = z.object({
  bookingId: z.number(),
  method: z.enum(['bkash', 'nagad', 'rocket', 'sslcommerz', 'card', 'bank', 'cash', 'mock']),
  amount: z.number().positive().optional()
});

const paymentVerifySchema = z.object({
  transactionId: z.string()
});

const paymentExecuteSchema = z.object({
  transactionId: z.string(),
  paymentID: z.string().optional()
});

const paymentQuerySchema = z.object({
  transactionId: z.string()
});

const refundSchema = z.object({
  transactionId: z.string(),
  reason: z.string().min(1)
});

function getGatewayConfig(method: string): PaymentGatewayConfig {
  const provider = method.toUpperCase();
  const envKey = provider === 'BKASH' ? 'BKASH' : provider;
  return {
    provider,
    apiKey: process.env[`${envKey}_APP_KEY`] || process.env[`${envKey}_API_KEY`] || process.env[`${envKey}_STORE_ID`],
    apiSecret: process.env[`${envKey}_APP_SECRET`] || process.env[`${envKey}_SECRET_KEY`] || process.env[`${envKey}_STORE_PASSWORD`],
    baseUrl: process.env[`${envKey}_BASE_URL`],
    webhookSecret: process.env.WEBHOOK_SECRET,
    timeoutMs: 30000
  };
}

// Server-authoritative confirmation shared by /verify and /execute.
// Returns { status, code, idempotent } which the caller maps to an HTTP resp.
async function confirmPaymentFromGateway(opts: {
  payment: any;
  gatewayResult: { success: boolean; status: string; amount?: number; currency?: string; paidAt?: Date; raw?: Record<string, unknown>; providerRefId?: string };
  expectedAmount: number;
  actorId?: number;
  actorRole?: string;
  action: string;
}) {
  const { payment, gatewayResult, expectedAmount, actorId, actorRole, action } = opts;

  if (!gatewayResult.success || gatewayResult.status !== 'success') {
    await prisma.payment.update({
      where: { transactionId: payment.transactionId },
      data: {
        status: 'failed',
        gatewayResponse: JSON.stringify({
          failedAt: new Date().toISOString(),
          gatewayStatus: gatewayResult.status || 'failed',
          gatewayMode: gatewayResult.raw?.mode || 'unknown',
          gatewayProvider: payment.method,
          action
        })
      }
    });
    return { httpStatus: 402, body: { error: 'Payment not confirmed by provider', status: gatewayResult.status || 'failed', transactionId: payment.transactionId } };
  }

  // Server-side amount enforcement: provider-confirmed amount MUST exactly
  // match the server-expected amount. Do not accept partial payments or
  // amount tampering.
  const confirmedAmount = Number(gatewayResult.amount);
  if (!Number.isFinite(confirmedAmount) || confirmedAmount !== expectedAmount) {
    await prisma.payment.update({
      where: { transactionId: payment.transactionId },
      data: {
        status: 'failed',
        gatewayResponse: JSON.stringify({
          failedAt: new Date().toISOString(),
          reason: 'amount_mismatch',
          expectedAmount,
          confirmedAmount,
          gatewayMode: gatewayResult.raw?.mode || 'unknown',
          gatewayProvider: payment.method,
          action
        })
      }
    });
    return {
      httpStatus: 402,
      body: {
        error: 'Payment amount mismatch with provider',
        status: 'failed',
        expectedAmount,
        confirmedAmount,
        transactionId: payment.transactionId
      }
    };
  }

  const confirmedCurrency = String(gatewayResult.currency || 'BDT').toUpperCase();
  if (confirmedCurrency !== 'BDT') {
    await prisma.payment.update({
      where: { transactionId: payment.transactionId },
      data: {
        status: 'failed',
        gatewayResponse: JSON.stringify({
          failedAt: new Date().toISOString(),
          reason: 'currency_mismatch',
          expectedCurrency: 'BDT',
          confirmedCurrency,
          gatewayMode: gatewayResult.raw?.mode || 'unknown',
          gatewayProvider: payment.method,
          action
        })
      }
    });
    return {
      httpStatus: 402,
      body: { error: 'Payment currency mismatch with provider', status: 'failed', expectedCurrency: 'BDT', confirmedCurrency, transactionId: payment.transactionId }
    };
  }

  // All security checks passed. Update within a transaction.
  const verification = await prisma.$transaction(async (tx) => {
    const currentPayment = await tx.payment.findUnique({ where: { transactionId: payment.transactionId }, include: { booking: true } });
    if (!currentPayment) throw { code: 'NOT_FOUND' };
    await expireHotelBookingIfNeeded(tx, currentPayment.booking);
    const booking = await tx.booking.findUnique({ where: { id: currentPayment.bookingId } });
    if (!booking || booking.status === 'cancelled' || booking.status === 'expired') throw { code: 'BOOKING_UNPAYABLE' };
    if (currentPayment.status === 'success' && booking.paymentStatus === 'paid') return { payment: currentPayment, idempotent: true };
    if (!canTransitionHotelBooking(booking.status, 'confirmed')) throw { code: 'INVALID_TRANSITION' };

    const providerTransactionId = gatewayResult.providerRefId || currentPayment.providerRefId;

    const updatedPayment = await tx.payment.update({
      where: { transactionId: payment.transactionId },
      data: {
        status: 'success',
        paidAt: gatewayResult.paidAt || new Date(),
        providerRefId: providerTransactionId,
        currency: confirmedCurrency,
        gatewayResponse: JSON.stringify({
          verifiedAt: new Date().toISOString(),
          confirmedAmount,
          confirmedCurrency,
          gatewayMode: gatewayResult.raw?.mode || 'unknown',
          gatewayProvider: payment.method,
          action
        })
      }
    });

    await tx.booking.update({ where: { id: booking.id }, data: { status: 'confirmed', paymentStatus: 'paid' } });

    if (booking.promotionId) {
      await tx.hotelPromotion.update({
        where: { id: booking.promotionId },
        data: { usedCount: { increment: 1 } }
      });
    }

    await tx.auditLog.create({
      data: {
        action,
        actorId: actorId ?? null,
        actorRole: actorRole ?? 'system',
        details: `Payment ${payment.transactionId} verified for booking ${booking.bookingCode}`,
        metadata: JSON.stringify({ bookingId: booking.id, paymentId: updatedPayment.id, amount: expectedAmount, confirmedAmount })
      }
    });

    return { payment: updatedPayment, idempotent: false };
  });

  return { httpStatus: 200, body: { message: 'Payment verified successfully', status: 'success', payment: verification.payment }, idempotent: verification.idempotent };
}

// POST /api/v1/payments/initiate
router.post('/initiate', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const parse = paymentInitiateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { bookingId, method } = parse.data;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.$transaction(tx => expireHotelBookingIfNeeded(tx, booking));
    const currentBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (currentBooking?.status === 'expired') {
      return res.status(400).json({ error: 'Cannot initiate payment for expired booking' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot initiate payment for cancelled booking' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ error: 'Booking already completed' });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Booking already paid' });
    }

    // Server-authoritative amount: ignore client-supplied amount and use
    // the booking's stored finalAmount. This prevents tampering with the
    // payable total during checkout.
    const serverAmount = Number(booking.finalAmount);
    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      return res.status(400).json({ error: 'Booking has no payable amount' });
    }

    const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Ask the gateway to create a payment session. The gateway computes
    // its own authoritative reference (bKash paymentID) which we persist
    // as providerRefId and NEVER accept from the client during verify.
    const gateway = resolvePaymentGateway(method, getGatewayConfig(method));

    let gatewayInitiate: Awaited<ReturnType<typeof gateway.initiate>>;
    try {
      gatewayInitiate = await gateway.initiate({
        bookingId,
        amount: serverAmount,
        currency: 'BDT',
        customerPhone: booking.user?.phone,
        customerEmail: booking.user?.email || undefined,
        metadata: { merchantInvoiceNumber: transactionId }
      });
    } catch (initError: any) {
      logWarn('Payment initiation rejected by gateway, failing closed', { method, bookingId, error: initError?.message });
      return res.status(402).json({
        error: `Cannot initiate payment with ${method}. Gateway is unavailable or misconfigured.`,
        status: 'pending',
        bookingId
      });
    }

    if (!gatewayInitiate.success || !gatewayInitiate.transactionId) {
      return res.status(402).json({
        error: `Payment initiation with ${method} was not confirmed by the provider`,
        status: 'pending',
        bookingId
      });
    }

    // For mock payments, auto-execute to transition the in-process mock
    // transaction to 'success' state. This enables a seamless dev/test flow
    // (initiate → verify) without a separate /execute call. Real gateways
    // still require the client to call /execute after provider confirmation.
    const sandboxMockMode =
      method === 'bkash' &&
      (process.env.PAYMENT_MODE || 'sandbox').toLowerCase() === 'sandbox' &&
      process.env.USE_MOCK_PAYMENT === 'true';

    const mockAutoExecute = method === 'mock' || (method === 'bkash' && process.env.USE_MOCK_PAYMENT === 'true');

    if (mockAutoExecute && gatewayInitiate.gatewayReference) {
      try {
        await gateway.execute({
          gatewayReference: gatewayInitiate.gatewayReference,
          transactionId
        });
      } catch {
        // Auto-execute failure for the in-memory mock gateway is non-fatal.
      }
    }

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount: serverAmount,
        currency: 'BDT',
        method,
        transactionId,
        providerRefId: gatewayInitiate.gatewayReference || null,
        status: 'init',
        gatewayResponse: JSON.stringify({
          gatewayUrl: gatewayInitiate.checkoutUrl || `/pay/${transactionId}`,
          checkoutUrl: gatewayInitiate.checkoutUrl,
          mode: gatewayInitiate.raw?.mode || 'unknown',
          initiatedAt: new Date().toISOString(),
          expiresAt: gatewayInitiate.expiresAt?.toISOString() || null
        })
      }
    });

    return res.status(201).json({
      message: 'Payment initiated',
      transactionId,
      paymentUrl: gatewayInitiate.checkoutUrl || `/pay/${transactionId}`,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        providerRefId: payment.providerRefId,
        checkoutUrl: gatewayInitiate.checkoutUrl,
        createdAt: payment.createdAt
      }
    });
  } catch (error: any) {
    console.error('Payment initiation error:', error);
    return res.status(500).json({ error: 'Payment initiation failed' });
  }
});

// POST /api/v1/payments/execute
// bKash Tokenized Checkout: after the customer completes the flow in the
// bKash sandbox, the client confirms with the paymentID returned by the
// provider callback. The server executes the payment with the provider and
// only then marks the booking paid.
router.post('/execute', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const parse = paymentExecuteSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { transactionId, paymentID } = parse.data;
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { booking: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Transaction record not found' });
    }

    if (payment.booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Idempotency: if already paid, return current state without re-executing
    if (payment.status === 'success' && payment.booking.paymentStatus === 'paid') {
      return res.json({ message: 'Payment already verified', status: 'success', payment });
    }

    // A server-issued provider reference is mandatory for execution.
    // Never fall back to the client-supplied paymentID or internal
    // transactionId as the gateway reference — that allows an attacker
    // to inject an arbitrary provider reference.
    if (!payment.providerRefId) {
      return res.status(402).json({
        error: 'This payment has no provider reference and cannot be executed. Please retry the payment.',
        status: 'pending',
        transactionId
      });
    }

    // Cross-check: client-supplied paymentID (from bKash callback) must
    // match the server-stored provider reference if both are provided.
    if (paymentID && payment.providerRefId !== paymentID) {
      return res.status(400).json({ error: 'Payment ID does not match this transaction' });
    }

    // Server-authoritative expected amount: always from the database.
    const expectedAmount = Number(payment.booking.finalAmount);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return res.status(400).json({ error: 'Booking has no payable amount' });
    }

    const gateway = resolvePaymentGateway(payment.method, getGatewayConfig(payment.method));

    let gatewayResult: Awaited<ReturnType<typeof gateway.execute>>;
    try {
      gatewayResult = await gateway.execute({
        gatewayReference: payment.providerRefId,
        transactionId
      });
    } catch (gatewayError: any) {
      logWarn('Gateway execution error, failing closed', { error: gatewayError?.message, provider: payment.method });
      return res.status(402).json({
        error: 'Payment execution is currently unavailable. Please try again later or contact support.',
        status: 'pending',
        transactionId
      });
    }

    const result = await confirmPaymentFromGateway({
      payment,
      gatewayResult,
      expectedAmount,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: 'PAYMENT_EXECUTED'
    });

    if (result.httpStatus !== 200) {
      return res.status(result.httpStatus).json(result.body);
    }

    try {
      await ensureSettlementForPaidBooking(payment.bookingId);
    } catch (settlementErr) {
      console.error('Settlement creation failed (non-fatal):', settlementErr);
    }

    return res.json(result.body);
  } catch (error: any) {
    if (error?.code === 'BOOKING_UNPAYABLE') return res.status(400).json({ error: 'Cannot execute payment for cancelled or expired booking' });
    if (error?.code === 'INVALID_TRANSITION') return res.status(400).json({ error: 'Booking cannot be confirmed from its current status' });
    console.error('Payment execution error:', error);
    return res.status(500).json({ error: 'Payment execution failed' });
  }
});

// POST /api/v1/payments/query
// Query the provider for the current gateway status of a transaction.
// Read-only: never changes payment or booking state.
router.post('/query', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const parse = paymentQuerySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { transactionId } = parse.data;
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { booking: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Transaction record not found' });
    }

    if (payment.booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!payment.providerRefId) {
      return res.status(402).json({
        error: 'This payment has no provider reference to query.',
        status: 'unknown',
        transactionId
      });
    }

    const gateway = resolvePaymentGateway(payment.method, getGatewayConfig(payment.method));

    let gatewayResult: Awaited<ReturnType<typeof gateway.queryPayment>>;
    try {
      gatewayResult = await gateway.queryPayment({
        gatewayReference: payment.providerRefId,
        transactionId
      });
    } catch (gatewayError: any) {
      logWarn('Gateway query error', { error: gatewayError?.message, provider: payment.method });
      return res.status(402).json({
        error: 'Payment status query is currently unavailable. Please try again later.',
        status: 'unknown',
        transactionId
      });
    }

    return res.json({
      transactionId,
      status: gatewayResult.status,
      success: gatewayResult.success,
      providerStatus: gatewayResult.raw,
      paidAt: gatewayResult.paidAt
    });
  } catch (error: any) {
    console.error('Payment query error:', error);
    return res.status(500).json({ error: 'Payment query failed' });
  }
});

// POST /api/v1/payments/verify
router.post('/verify', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const parse = paymentVerifySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { transactionId } = parse.data;
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { booking: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Transaction record not found' });
    }

    if (payment.booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Idempotency: if already paid, return current state without re-verifying
    if (payment.status === 'success' && payment.booking.paymentStatus === 'paid') {
      return res.json({ message: 'Payment already verified', status: 'success', payment });
    }

    // Server-authoritative expected amount: always from the database,
    // never from client input.
    const expectedAmount = Number(payment.booking.finalAmount);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return res.status(400).json({ error: 'Booking has no payable amount' });
    }

    // A server-issued provider reference is mandatory for verification.
    // Never use the internal transactionId (TXN-...) as a gateway reference
    // — the provider does not recognise it and legacy mock gateways could
    // blindly accept it, creating a false-SUCCESS hole.
    if (!payment.providerRefId) {
      return res.status(402).json({
        error: 'This payment has no provider reference and cannot be verified. Please retry the payment.',
        status: 'pending',
        transactionId
      });
    }

    const gateway = resolvePaymentGateway(payment.method, getGatewayConfig(payment.method));

    let gatewayResult: Awaited<ReturnType<typeof gateway.verify>>;
    try {
      gatewayResult = await gateway.verify({
        gatewayReference: payment.providerRefId,
        transactionId,
        expectedAmount,
        expectedCurrency: 'BDT'
      });
    } catch (gatewayError: any) {
      // FAIL CLOSED: gateway unavailable or misconfigured.
      // Never mark payment as SUCCESS when provider verification is unavailable.
      logWarn('Gateway verification error, failing closed', { error: gatewayError?.message, provider: payment.method });
      return res.status(402).json({
        error: 'Payment verification is currently unavailable. Please try again later or contact support.',
        status: 'pending',
        transactionId
      });
    }

    const result = await confirmPaymentFromGateway({
      payment,
      gatewayResult,
      expectedAmount,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: 'HOTEL_PAYMENT_VERIFIED'
    });

    if (result.httpStatus !== 200) {
      return res.status(result.httpStatus).json(result.body);
    }

    // Financial ledger: idempotently create a Settlement row for any
    // vendor-service booking that just became paid. Bus Bookings (no
    // serviceId) are skipped so existing flows are not affected.
    try {
      await ensureSettlementForPaidBooking(payment.bookingId);
    } catch (settlementErr) {
      console.error('Settlement creation failed (non-fatal):', settlementErr);
    }

    return res.json(result.body);
  } catch (error: any) {
    if (error?.code === 'BOOKING_UNPAYABLE') return res.status(400).json({ error: 'Cannot verify payment for cancelled or expired booking' });
    if (error?.code === 'INVALID_TRANSITION') return res.status(400).json({ error: 'Booking cannot be confirmed from its current status' });
    console.error('Payment verification error:', error);
    return res.status(500).json({ error: 'Payment verification failed' });
  }
});

// POST /api/v1/payments/retry
router.post('/retry', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const { transactionId } = req.body;
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { booking: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Original payment record not found' });
    }

    if (payment.booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (payment.booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot retry payment for cancelled booking' });
    }

    if (payment.booking.status === 'expired') {
      return res.status(400).json({ error: 'Cannot retry payment for expired booking' });
    }

    if (payment.status === 'success') {
      return res.status(400).json({ error: 'Original payment was successful' });
    }

    const newTransactionId = `TXN-RETRY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const gateway = resolvePaymentGateway(payment.method, getGatewayConfig(payment.method));
    let gatewayInitiate: Awaited<ReturnType<typeof gateway.initiate>>;
    try {
      gatewayInitiate = await gateway.initiate({
        bookingId: payment.bookingId,
        amount: Number(payment.booking.finalAmount) || payment.amount,
        currency: 'BDT',
        metadata: { merchantInvoiceNumber: newTransactionId }
      });
    } catch (initError: any) {
      logWarn('Retry initiation rejected by gateway, failing closed', { error: initError?.message, method: payment.method });
      return res.status(402).json({
        error: 'Cannot retry payment. Gateway is unavailable or misconfigured.',
        status: 'pending',
        transactionId
      });
    }

    const retryPayment = await prisma.payment.create({
      data: {
        bookingId: payment.bookingId,
        amount: payment.amount,
        currency: 'BDT',
        method: payment.method,
        transactionId: newTransactionId,
        providerRefId: gatewayInitiate.gatewayReference || null,
        status: 'init',
        gatewayResponse: JSON.stringify({
          gatewayUrl: gatewayInitiate.checkoutUrl || `/pay/${newTransactionId}`,
          retriedFrom: transactionId,
          initiatedAt: new Date().toISOString()
        })
      }
    });

    return res.json({
      message: 'Payment retry initiated',
      newTransactionId,
      paymentUrl: gatewayInitiate.checkoutUrl || `/pay/${newTransactionId}`,
      payment: {
        id: retryPayment.id,
        amount: retryPayment.amount,
        method: retryPayment.method,
        status: retryPayment.status,
        checkoutUrl: gatewayInitiate.checkoutUrl
      }
    });
  } catch (error: any) {
    console.error('Payment retry error:', error);
    return res.status(500).json({ error: 'Payment retry failed' });
  }
});

// GET /api/v1/payments/reconciliation
router.get('/reconciliation', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { booking: true },
      orderBy: { createdAt: 'desc' }
    });

    const reconciled = payments.map(p => ({
      transactionId: p.transactionId,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      providerRefId: p.providerRefId,
      gatewayStatus: p.status,
      bookingStatus: p.booking.paymentStatus,
      isMatched: p.status === 'success' ? p.booking.paymentStatus === 'paid' : true
    }));

    return res.json({
      totalChecked: payments.length,
      discrepancies: reconciled.filter(r => !r.isMatched).length,
      records: reconciled
    });
  } catch (error: any) {
    console.error('Reconciliation error:', error);
    return res.status(500).json({ error: 'Reconciliation failed' });
  }
});

// POST /api/v1/payments/settlement
router.post('/settlement', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { providerId, amount, commissionRate } = req.body;

    if (!providerId || !amount) {
      return res.status(400).json({ error: 'providerId and amount are required' });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive finite number' });
    }

    let rate: number;
    if (commissionRate != null && Number.isFinite(Number(commissionRate))) {
      rate = Math.max(0, Math.min(100, Number(commissionRate)));
    } else {
      const provider = await prisma.serviceProvider.findUnique({
        where: { id: Number(providerId) },
        select: { commissionRate: true }
      });
      rate = await resolveCommissionRate({ providerRate: provider?.commissionRate });
    }

    const commission = round2((numericAmount * rate) / 100);
    const netPayout = round2(numericAmount - commission);

    const settlementId = `STL-${Date.now()}`;

    return res.json({
      success: true,
      settlementId,
      providerId: Number(providerId),
      grossAmount: numericAmount,
      commissionRate: rate,
      commissionAmount: commission,
      netPayoutAmount: netPayout,
      status: 'SETTLED',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Settlement error:', error);
    return res.status(500).json({ error: 'Settlement failed' });
  }
});

// POST /api/v1/payments/refund
router.post('/refund', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const parse = refundSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { transactionId, reason } = parse.data;
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: { booking: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'success') {
      return res.status(400).json({ error: 'Can only refund successful payments' });
    }

    if (payment.booking.status === 'cancelled' || payment.booking.status === 'expired') {
      return res.status(400).json({ error: 'Cannot refund a cancelled or expired booking' });
    }

    if (payment.booking.paymentStatus === 'refunded') {
      return res.status(400).json({ error: 'Booking payment has already been refunded' });
    }

    if (!payment.providerRefId) {
      return res.status(402).json({
        error: 'This payment has no provider reference and cannot be refunded.',
        status: 'failed',
        transactionId
      });
    }

    // Ask the provider to refund the money BEFORE mutating local state.
    // Provider funding failure must NOT mark the payment refunded locally.
    const gateway = resolvePaymentGateway(payment.method, getGatewayConfig(payment.method));
    let gatewayRefund: Awaited<ReturnType<typeof gateway.refund>>;
    try {
      gatewayRefund = await gateway.refund({
        gatewayReference: payment.providerRefId,
        transactionId,
        amount: payment.amount,
        reason
      });
    } catch (gatewayError: any) {
      logWarn('Gateway refund error, failing closed', { error: gatewayError?.message, provider: payment.method });
      return res.status(402).json({
        error: 'Refund could not be processed by the provider. Please try again later.',
        status: 'failed',
        transactionId
      });
    }

    if (!gatewayRefund.success || gatewayRefund.status !== 'refunded') {
      return res.status(402).json({
        error: 'Provider did not confirm the refund',
        status: gatewayRefund.status || 'failed',
        transactionId
      });
    }

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { transactionId },
        data: {
          status: 'refunded',
          refundedAt: new Date(),
          refundReason: reason,
          providerRefId: payment.providerRefId,
          gatewayResponse: JSON.stringify({
            refundedAt: new Date().toISOString(),
            refundReference: gatewayRefund.refundReference,
            reason
          })
        }
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'cancelled',
          paymentStatus: 'refunded',
          cancelledAt: new Date(),
          rejectionReason: `Refunded: ${reason}`
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'HOTEL_PAYMENT_REFUNDED',
          actorId: req.user!.id,
          actorRole: req.user!.role,
          details: `Payment ${transactionId} refunded for booking ${payment.booking.bookingCode}`,
          metadata: JSON.stringify({ bookingId: payment.bookingId, paymentId: payment.id, amount: payment.amount, reason, refundReference: gatewayRefund.refundReference })
        }
      });

      return updated;
    });

    return res.json({
      message: 'Payment refunded successfully',
      reason,
      refundId: gatewayRefund.refundReference || `REF-${Date.now()}`,
      payment: updatedPayment
    });
  } catch (error: any) {
    console.error('Refund error:', error);
    return res.status(500).json({ error: 'Refund failed' });
  }
});

// GET /api/v1/payments/:transactionId
router.get('/:transactionId', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const { transactionId } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: {
        booking: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
            provider: { select: { id: true, businessName: true } }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(payment);
  } catch (error: any) {
    console.error('Payment fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

export default router;