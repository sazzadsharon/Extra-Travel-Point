import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

const paymentInitiateSchema = z.object({
  bookingId: z.number(),
  method: z.enum(['bkash', 'nagad', 'rocket', 'sslcommerz', 'card', 'bank']),
  amount: z.number().positive()
});

const paymentVerifySchema = z.object({
  transactionId: z.string(),
  gatewayReference: z.string().optional()
});

const refundSchema = z.object({
  transactionId: z.string(),
  reason: z.string().min(1)
});

// POST /api/v1/payments/initiate
router.post('/initiate', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const parse = paymentInitiateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { bookingId, method, amount } = parse.data;
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

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Booking already paid' });
    }

    const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount,
        method,
        transactionId,
        status: 'init',
        gatewayResponse: JSON.stringify({
          gatewayUrl: `/pay/${transactionId}`,
          initiatedAt: new Date().toISOString()
        })
      }
    });

    return res.status(201).json({
      message: 'Payment initiated',
      transactionId,
      paymentUrl: `/pay/${transactionId}`,
      payment: {
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        createdAt: payment.createdAt
      }
    });
  } catch (error: any) {
    console.error('Payment initiation error:', error);
    return res.status(500).json({ error: 'Payment initiation failed' });
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

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { transactionId },
      data: {
        status: 'success',
        paidAt: new Date(),
        gatewayResponse: JSON.stringify({
          verifiedAt: new Date().toISOString(),
          gatewayReference: parse.data.gatewayReference
        })
      }
    });

    // Update booking status
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: 'confirmed',
        paymentStatus: 'paid'
      }
    });

    return res.json({
      message: 'Payment verified successfully',
      status: 'success',
      payment: updatedPayment
    });
  } catch (error: any) {
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

    if (payment.status === 'success') {
      return res.status(400).json({ error: 'Original payment was successful' });
    }

    const newTransactionId = `TXN-RETRY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const retryPayment = await prisma.payment.create({
      data: {
        bookingId: payment.bookingId,
        amount: payment.amount,
        method: payment.method,
        transactionId: newTransactionId,
        status: 'init',
        gatewayResponse: JSON.stringify({
          gatewayUrl: `/pay/${newTransactionId}`,
          retriedFrom: transactionId,
          initiatedAt: new Date().toISOString()
        })
      }
    });

    return res.json({
      message: 'Payment retry initiated',
      newTransactionId,
      paymentUrl: `/pay/${newTransactionId}`,
      payment: {
        id: retryPayment.id,
        amount: retryPayment.amount,
        method: retryPayment.method,
        status: retryPayment.status
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
      method: p.method,
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

    const rate = commissionRate || 10.0;
    const commission = (amount * rate) / 100;
    const netPayout = amount - commission;

    const settlementId = `STL-${Date.now()}`;

    return res.json({
      success: true,
      settlementId,
      providerId: Number(providerId),
      grossAmount: amount,
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

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { transactionId },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundReason: reason
      }
    });

    // Update booking status
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: 'cancelled',
        paymentStatus: 'refunded',
        cancelledAt: new Date()
      }
    });

    return res.json({
      message: 'Payment refunded successfully',
      reason,
      refundId: `REF-${Date.now()}`,
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
