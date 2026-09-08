import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';
import paymentRoutes from '../src/routes/payment.routes';
import webhookRoutes from '../src/routes/webhook.routes';
import crypto from 'crypto';

function signToken(payload: { id: number; phone: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test', { expiresIn: '2h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/webhooks', webhookRoutes);
  return app;
}

function request_(app: express.Express, method: string, path: string, opts: { token?: string; body?: any; headers?: Record<string, string> } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as { port: number };
      const data = opts.body ? JSON.stringify(opts.body) : null;
      const req = http.request(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
          ...(opts.headers || {})
        }
      }, res => {
        const chunks: Buffer[] = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body: any = text;
          try { body = JSON.parse(text); } catch { /* */ }
          resolve({ status: res.statusCode || 0, body });
          server.close();
        });
      });
      req.on('error', err => { reject(err); server.close(); });
      if (data) req.write(data);
      req.end();
    });
  });
}

async function cleanup() {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.hotelAvailability.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.hotelImage.deleteMany();
  await prisma.hotelAmenity.deleteMany();
  await prisma.hotelPolicy.deleteMany();
  await prisma.hotelPromotion.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.hotelMaintenanceRequest.deleteMany();
  await prisma.hotelTax.deleteMany();
  await prisma.hotelStaff.deleteMany();
  await prisma.serviceAvailability.deleteMany();
  await prisma.service.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.busTrip.deleteMany();
  await prisma.busRoute.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.room.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
}

let webhookUserCounter = 0;

async function setupWorld() {
  webhookUserCounter += 1;
  const v = await prisma.user.create({
    data: { phone: `0191110000${webhookUserCounter}`, passwordHash: 'h', role: 'vendor' }
  });
  const h = await prisma.serviceProvider.create({
    data: {
      userId: v.id, businessName: 'H', category: 'hotel', address: '1', city: 'D',
      status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
    }
  });
  const room = await prisma.room.create({
    data: {
      providerId: h.id, name: 'STD', type: 'STD', price: 2000,
      capacity: 2, adultCapacity: 2, childCapacity: 0, totalRooms: 5,
      isAvailable: true, baseCurrency: 'BDT', status: 'ACTIVE'
    }
  });
  const c = await prisma.user.create({ data: { phone: `0192220000${webhookUserCounter}`, passwordHash: 'h', role: 'customer' } });
  return { v, h, room, c };
}

function createWebhookSignature(body: any, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(body)).digest('hex');
  return digest;
}

describe('STEP 9-C — Webhook Security Hardening', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  afterEach(async () => { await cleanup(); });

  describe('Missing WEBHOOK_SECRET', () => {
    it('returns 503 when WEBHOOK_SECRET is missing', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();

      const booking = await prisma.booking.create({
        data: {
          userId: c.id, providerId: h.id, roomId: room.id,
          category: 'hotel', bookingDate: new Date(), travelDate: new Date(Date.now() + 86400000),
          returnDate: new Date(Date.now() + 172800000), numberOfPeople: 1, numberOfRooms: 1,
          totalAmount: 2000, discountAmount: 0, finalAmount: 2000,
          status: 'pending', paymentStatus: 'pending', source: 'ETP',
          bookingCode: 'BK-' + crypto.randomBytes(4).toString('hex')
        } as any
      });

      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id, amount: 2000, currency: 'BDT', method: 'bkash',
          transactionId: 'TXN-' + Date.now(), status: 'init'
        }
      });

      const original = process.env.WEBHOOK_SECRET;
      try {
        delete process.env.WEBHOOK_SECRET;

        const body = { paymentId: payment.id, status: 'Completed', trxID: payment.transactionId, amount: 2000 };
        const signature = createWebhookSignature(body, '');
        const res = await request_(app, 'POST', `/api/v1/webhooks/bkash`, {
          body,
          headers: { 'x-webhook-signature': signature }
        });

        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/WEBHOOK_SECRET/i);
      } finally {
        if (original !== undefined) process.env.WEBHOOK_SECRET = original;
        else delete process.env.WEBHOOK_SECRET;
      }

      const updatedPayment = await prisma.payment.findUnique({ where: { transactionId: payment.transactionId } });
      expect(updatedPayment?.status).toBe('init');
      const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(updatedBooking?.paymentStatus).not.toBe('paid');
      expect(updatedBooking?.status).not.toBe('confirmed');
    });

    it('returns 503 when WEBHOOK_SECRET is empty string', async () => {
      const { h, room, c } = await setupWorld();

      const booking = await prisma.booking.create({
        data: {
          userId: c.id, providerId: h.id, roomId: room.id,
          category: 'hotel', bookingDate: new Date(), travelDate: new Date(Date.now() + 86400000),
          returnDate: new Date(Date.now() + 172800000), numberOfPeople: 1, numberOfRooms: 1,
          totalAmount: 2000, discountAmount: 0, finalAmount: 2000,
          status: 'pending', paymentStatus: 'pending', source: 'ETP',
          bookingCode: 'BK-' + crypto.randomBytes(4).toString('hex')
        } as any
      });

      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id, amount: 2000, currency: 'BDT', method: 'bkash',
          transactionId: 'TXN-' + Date.now(), status: 'init'
        }
      });

      const original = process.env.WEBHOOK_SECRET;
      try {
        process.env.WEBHOOK_SECRET = '';

        const app = createApp();
        const body = { paymentId: payment.id, status: 'Completed', trxID: payment.transactionId, amount: 2000 };
        const signature = createWebhookSignature(body, '');
        const res = await request_(app, 'POST', `/api/v1/webhooks/bkash`, {
          body,
          headers: { 'x-webhook-signature': signature }
        });

        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/WEBHOOK_SECRET/i);
      } finally {
        if (original !== undefined) process.env.WEBHOOK_SECRET = original;
        else delete process.env.WEBHOOK_SECRET;
      }

      const updatedPayment = await prisma.payment.findUnique({ where: { transactionId: payment.transactionId } });
      expect(updatedPayment?.status).toBe('init');
      const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(updatedBooking?.paymentStatus).not.toBe('paid');
      expect(updatedBooking?.status).not.toBe('confirmed');
    });

    it('webhook does not process payment when secret is missing even with valid-looking body', async () => {
      const { h, room, c } = await setupWorld();

      const booking = await prisma.booking.create({
        data: {
          userId: c.id, providerId: h.id, roomId: room.id,
          category: 'hotel', bookingDate: new Date(), travelDate: new Date(Date.now() + 86400000),
          returnDate: new Date(Date.now() + 172800000), numberOfPeople: 1, numberOfRooms: 1,
          totalAmount: 2000, discountAmount: 0, finalAmount: 2000,
          status: 'pending', paymentStatus: 'pending', source: 'ETP',
          bookingCode: 'BK-' + crypto.randomBytes(4).toString('hex')
        } as any
      });

      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id, amount: 2000, currency: 'BDT', method: 'bkash',
          transactionId: 'TXN-' + Date.now(), status: 'init'
        }
      });

      const original = process.env.WEBHOOK_SECRET;
      try {
        delete process.env.WEBHOOK_SECRET;

        const app = createApp();
        const body = { payment_ref_id: payment.transactionId, status: 'Success', issuer_payment_ref_no: payment.transactionId, amount: 2000 };
        const signature = createWebhookSignature(body, '');
        const res = await request_(app, 'POST', `/api/v1/webhooks/nagad`, {
          body,
          headers: { 'x-webhook-signature': signature }
        });

        expect(res.status).toBe(503);

        const updatedPayment = await prisma.payment.findUnique({ where: { transactionId: payment.transactionId } });
        expect(updatedPayment?.status).toBe('init');
      } finally {
        if (original !== undefined) process.env.WEBHOOK_SECRET = original;
        else delete process.env.WEBHOOK_SECRET;
      }
    });
  });

  describe('Stub gateway verification fails closed', () => {
    it('stub verify throws and does not return amount: input.expectedAmount', async () => {
      const { BkashPaymentGateway, NagadPaymentGateway, SSLCommerzPaymentGateway } = require('../src/utils/payment-gateways');

      const bkash = new BkashPaymentGateway({ provider: 'bkash', apiKey: 'test', apiSecret: 'test', baseUrl: 'https://sandbox.bka.sh' });
      await expect(bkash.verify({ gatewayReference: 'TX', transactionId: 'TX', expectedAmount: 100, expectedCurrency: 'BDT' })).rejects.toThrow(/not implemented for production use/i);

      const nagad = new NagadPaymentGateway({ provider: 'nagad', apiKey: 'test', apiSecret: 'test', baseUrl: 'https://sandbox.nagad.com' });
      await expect(nagad.verify({ gatewayReference: 'TX', transactionId: 'TX', expectedAmount: 100, expectedCurrency: 'BDT' })).rejects.toThrow(/not implemented for production use/i);

      const ssl = new SSLCommerzPaymentGateway({ provider: 'sslcommerz', apiKey: 'test', apiSecret: 'test', baseUrl: 'https://sandbox.sslcommerz.com' });
      await expect(ssl.verify({ gatewayReference: 'TX', transactionId: 'TX', expectedAmount: 100, expectedCurrency: 'BDT' })).rejects.toThrow(/not implemented for production use/i);
    });
  });

  describe('Sandbox gateway behavior unchanged', () => {
    it('BkashSandboxGateway refuses to run when PAYMENT_MODE is not sandbox', async () => {
      const { BkashSandboxGateway } = require('../src/utils/payment-gateways');
      const mode = process.env.PAYMENT_MODE;
      process.env.PAYMENT_MODE = 'production';
      try {
        const gw = new BkashSandboxGateway({ provider: 'bkash' });
        await expect(gw.initiate({ bookingId: 1, amount: 1000, currency: 'BDT' })).rejects.toThrow(/sandbox/i);
        await expect(gw.verify({ gatewayReference: 'x', transactionId: 'y', expectedAmount: 100, expectedCurrency: 'BDT' })).rejects.toThrow(/sandbox/i);
      } finally {
        process.env.PAYMENT_MODE = mode || '';
        if (!mode) delete process.env.PAYMENT_MODE;
      }
    });
  });
});
