import { Router } from 'express';
import { prisma } from '../prisma';
import crypto from 'crypto';

const router = Router();

const requireWebhookSecret = (req: any, res: any): boolean => {
  if (!process.env.WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Webhook processing unavailable: WEBHOOK_SECRET is not configured' });
    return false;
  }
  return true;
};

const verifyWebhookSignature = (req: any): boolean => {
  const signature = req.headers['x-webhook-signature'];
  if (!signature || typeof signature !== 'string') return false;
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
  const sigBuf = Buffer.from(signature);
  const digestBuf = Buffer.from(digest);
  if (sigBuf.length !== digestBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, digestBuf);
};

async function processSuccessfulWebhook(tx: any, paymentId: number, bookingId: number, bookingCode: string, amount: number | undefined, provider: string) {
  const payment = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { processed: false, reason: 'payment_not_found' };

  if (payment.status === 'success') {
    return { processed: false, reason: 'already_processed', payment };
  }

  if (payment.status !== 'init' && payment.status !== 'pending') {
    return { processed: false, reason: 'invalid_payment_status', payment };
  }

  const booking = await tx.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === 'cancelled' || booking.status === 'expired') {
    return { processed: false, reason: 'booking_unavailable' };
  }

  const expectedAmount = Number(booking.finalAmount);
  if (amount != null && Number.isFinite(amount) && Number(amount) !== expectedAmount) {
    return { processed: false, reason: 'amount_mismatch', expectedAmount, confirmedAmount: amount };
  }

  const updatedPayment = await tx.payment.update({
    where: { id: paymentId },
    data: {
      status: 'success',
      paidAt: new Date(),
      gatewayResponse: JSON.stringify({
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'webhook',
        gatewayProvider: provider,
        confirmedAmount: amount ?? expectedAmount
      })
    }
  });

  await tx.booking.update({
    where: { id: bookingId },
    data: { status: 'confirmed', paymentStatus: 'paid' }
  });

  await tx.auditLog.create({
    data: {
      action: 'HOTEL_PAYMENT_WEBHOOK_VERIFIED',
      actorId: null,
      actorRole: 'system',
      details: `Payment ${payment.transactionId} verified via ${provider} webhook for booking ${bookingCode}`,
      metadata: JSON.stringify({ paymentId, bookingId, amount: expectedAmount, confirmedAmount: amount })
    }
  });

  return { processed: true, payment: updatedPayment };
}

// POST /api/v1/webhooks/bkash
router.post('/bkash', async (req, res) => {
  try {
    if (!requireWebhookSecret(req, res)) return;

    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { paymentId, status, trxID, amount } = req.body;

    if (status !== 'Completed' || !trxID) {
      return res.json({ success: true, message: 'bKash webhook ignored (not completed)' });
    }

    const payment = await prisma.payment.findFirst({ where: { transactionId: trxID }, include: { booking: true } });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for transaction' });
    }

    if (payment.method !== 'bkash') {
      return res.status(400).json({ error: 'Payment method does not match webhook provider' });
    }

    const result = await prisma.$transaction(async (tx) => {
      return processSuccessfulWebhook(tx, payment.id, payment.bookingId, '', amount, 'bkash');
    });

    if (!result.processed && result.reason === 'amount_mismatch') {
      return res.status(400).json({ error: 'Amount mismatch', expectedAmount: result.expectedAmount, confirmedAmount: result.confirmedAmount });
    }

    return res.json({ success: true, message: 'bKash webhook processed', processed: result.processed });
  } catch (error: any) {
    console.error('bKash webhook error:', error);
    return res.status(500).json({ error: 'bKash webhook processing failed' });
  }
});

// POST /api/v1/webhooks/nagad
router.post('/nagad', async (req, res) => {
  try {
    if (!requireWebhookSecret(req, res)) return;

    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { payment_ref_id, status, issuer_payment_ref_no, amount } = req.body;

    if (status !== 'Success' || !payment_ref_id) {
      return res.json({ success: true, message: 'Nagad webhook ignored (not successful)' });
    }

    const payment = await prisma.payment.findFirst({ where: { transactionId: payment_ref_id }, include: { booking: true } });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for transaction' });
    }

    if (payment.method !== 'nagad') {
      return res.status(400).json({ error: 'Payment method does not match webhook provider' });
    }

    const result = await prisma.$transaction(async (tx) => {
      return processSuccessfulWebhook(tx, payment.id, payment.bookingId, '', amount, 'nagad');
    });

    if (!result.processed && result.reason === 'amount_mismatch') {
      return res.status(400).json({ error: 'Amount mismatch', expectedAmount: result.expectedAmount, confirmedAmount: result.confirmedAmount });
    }

    return res.json({ success: true, message: 'Nagad webhook processed', processed: result.processed });
  } catch (error: any) {
    console.error('Nagad webhook error:', error);
    return res.status(500).json({ error: 'Nagad webhook processing failed' });
  }
});

// POST /api/v1/webhooks/rocket
router.post('/rocket', async (req, res) => {
  try {
    if (!requireWebhookSecret(req, res)) return;

    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { transactionId, status, amount } = req.body;

    if (status !== 'SUCCESS' || !transactionId) {
      return res.json({ success: true, message: 'Rocket webhook ignored (not successful)' });
    }

    const payment = await prisma.payment.findFirst({ where: { transactionId }, include: { booking: true } });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for transaction' });
    }

    if (payment.method !== 'rocket') {
      return res.status(400).json({ error: 'Payment method does not match webhook provider' });
    }

    const result = await prisma.$transaction(async (tx) => {
      return processSuccessfulWebhook(tx, payment.id, payment.bookingId, '', amount, 'rocket');
    });

    if (!result.processed && result.reason === 'amount_mismatch') {
      return res.status(400).json({ error: 'Amount mismatch', expectedAmount: result.expectedAmount, confirmedAmount: result.confirmedAmount });
    }

    return res.json({ success: true, message: 'Rocket webhook processed', processed: result.processed });
  } catch (error: any) {
    console.error('Rocket webhook error:', error);
    return res.status(500).json({ error: 'Rocket webhook processing failed' });
  }
});

// POST /api/v1/webhooks/sslcommerz
router.post('/sslcommerz', async (req, res) => {
  try {
    if (!requireWebhookSecret(req, res)) return;

    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { tran_id, status, amount } = req.body;

    if (status !== 'VALID' || !tran_id) {
      return res.json({ success: true, message: 'SSLCommerz IPN ignored (not valid)' });
    }

    const payment = await prisma.payment.findFirst({ where: { transactionId: tran_id }, include: { booking: true } });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for transaction' });
    }

    if (payment.method !== 'sslcommerz') {
      return res.status(400).json({ error: 'Payment method does not match webhook provider' });
    }

    const result = await prisma.$transaction(async (tx) => {
      return processSuccessfulWebhook(tx, payment.id, payment.bookingId, '', amount, 'sslcommerz');
    });

    if (!result.processed && result.reason === 'amount_mismatch') {
      return res.status(400).json({ error: 'Amount mismatch', expectedAmount: result.expectedAmount, confirmedAmount: result.confirmedAmount });
    }

    return res.json({ success: true, message: 'SSLCommerz IPN processed', processed: result.processed });
  } catch (error: any) {
    console.error('SSLCommerz webhook error:', error);
    return res.status(500).json({ error: 'SSLCommerz webhook processing failed' });
  }
});

export default router;
