import { Router } from 'express';
import { prisma } from '../prisma';
import crypto from 'crypto';

const router = Router();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

const verifyWebhookSignature = (req: any): boolean => {
  const signature = req.headers['x-webhook-signature'];
  if (!signature || typeof signature !== 'string') return false;
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
  const sigBuf = Buffer.from(signature);
  const digestBuf = Buffer.from(digest);
  if (sigBuf.length !== digestBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, digestBuf);
};

// POST /api/v1/webhooks/bkash
router.post('/bkash', async (req, res) => {
  try {
    const { paymentId, status, trxID, amount } = req.body;
    console.log(`[bKash Webhook Received] TRX: ${trxID}, Status: ${status}`);

    if (status === 'Completed' && trxID) {
      const payment = await prisma.payment.findFirst({ where: { transactionId: trxID } });
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'success' }
        });
        await prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'confirmed', paymentStatus: 'paid' }
        });
      }
    }

    return res.json({ success: true, message: 'bKash webhook processed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/webhooks/nagad
router.post('/nagad', async (req, res) => {
  try {
    const { payment_ref_id, status, issuer_payment_ref_no } = req.body;
    console.log(`[Nagad Webhook Received] Ref: ${issuer_payment_ref_no}`);

    if (status === 'Success' && payment_ref_id) {
      const payment = await prisma.payment.findFirst({ where: { transactionId: payment_ref_id } });
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'success' }
        });
        await prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'confirmed', paymentStatus: 'paid' }
        });
      }
    }

    return res.json({ success: true, message: 'Nagad webhook processed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/webhooks/rocket
router.post('/rocket', async (req, res) => {
  try {
    const { transactionId, status } = req.body;
    console.log(`[Rocket Webhook Received] TRX: ${transactionId}`);

    if (status === 'SUCCESS' && transactionId) {
      const payment = await prisma.payment.findFirst({ where: { transactionId } });
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'success' }
        });
        await prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'confirmed', paymentStatus: 'paid' }
        });
      }
    }

    return res.json({ success: true, message: 'Rocket webhook processed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/webhooks/sslcommerz
router.post('/sslcommerz', async (req, res) => {
  try {
    const { tran_id, status } = req.body;
    console.log(`[SSLCommerz IPN Received] TRX: ${tran_id}`);

    if (status === 'VALID' && tran_id) {
      const payment = await prisma.payment.findFirst({ where: { transactionId: tran_id } });
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'success' }
        });
        await prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'confirmed', paymentStatus: 'paid' }
        });
      }
    }

    return res.json({ success: true, message: 'SSLCommerz IPN processed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
