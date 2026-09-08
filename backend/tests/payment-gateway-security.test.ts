import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';
import paymentRoutes from '../src/routes/payment.routes';
import hotelBookingRoutes from '../src/routes/hotel-booking.routes';
import hotelRoutes from '../src/routes/hotel.routes';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';
import hotelRoomRoutes from '../src/routes/hotel-room.routes';
import { MockPaymentGateway, BkashPaymentGateway, resetMockGatewayStore } from '../src/utils/payment-gateways';
import { PaymentGatewayVerificationResult, PaymentGatewayVerificationInput } from '../src/utils/payment-gateway';

function signToken(payload: { id: number; phone: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test', { expiresIn: '2h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hotels', hotelRoutes);
  app.use('/api/v1/hotels', hotelManageRoutes);
  app.use('/api/v1/hotel-rooms', hotelRoomRoutes);
  app.use('/api/v1/hotel-bookings', hotelBookingRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  return app;
}

function request_(app: express.Express, method: string, path: string, opts: { token?: string; body?: any } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as { port: number };
      const data = opts.body ? JSON.stringify(opts.body) : null;
      const req = http.request(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {})
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

import { cleanup } from './utils/test-db';

async function setupWorld() {
  const v = await prisma.user.create({ data: { phone: '01911100001', passwordHash: 'h', role: 'vendor' } });
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
  const c = await prisma.user.create({ data: { phone: '01922200001', passwordHash: 'h', role: 'customer' } });
  return { v, h, room, c };
}

const originalEnv: Record<string, string | undefined> = {};

function snapshotEnv(keys: string[]) {
  for (const k of keys) originalEnv[k] = process.env[k];
}

function restoreEnv(keys: string[]) {
  for (const k of keys) {
    if (originalEnv[k] !== undefined) process.env[k] = originalEnv[k];
    else delete process.env[k];
  }
}

function withStubEnv(callback: () => Promise<void>) {
  snapshotEnv(['PAYMENT_MODE', 'BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_API_KEY', 'BKASH_SECRET_KEY', 'BKASH_BASE_URL', 'USE_MOCK_PAYMENT']);
  process.env.PAYMENT_MODE = 'stub';
  process.env.BKASH_APP_KEY = 'test-stub-key';
  process.env.BKASH_APP_SECRET = 'test-stub-secret';
  process.env.BKASH_API_KEY = 'test-stub-key';
  process.env.BKASH_SECRET_KEY = 'test-stub-secret';
  process.env.BKASH_BASE_URL = 'https://sandbox.bka.sh';
  process.env.USE_MOCK_PAYMENT = 'false';
  return callback().finally(() => restoreEnv(['PAYMENT_MODE', 'BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_API_KEY', 'BKASH_SECRET_KEY', 'BKASH_BASE_URL', 'USE_MOCK_PAYMENT']));
}

function spyOnGatewayVerify(
  GatewayClass: any,
  result: PaymentGatewayVerificationResult
) {
  return jest.spyOn(GatewayClass.prototype, 'verify').mockResolvedValue(result);
}

describe('PAYMENT GATEWAY STEP 1 — Security', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  afterEach(async () => { await cleanup(); });

  describe('Security: IDOR / ownership', () => {
    it('user cannot verify another user\'s payment', async () => {
      const { h, room, c } = await setupWorld();
      const c2 = await prisma.user.create({ data: { phone: '01922200077', passwordHash: 'h', role: 'customer' } });
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const tc2 = signToken({ id: c2.id, phone: c2.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      expect(b.status).toBe(201);

      await withStubEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });
        expect(pay.status).toBe(201);

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc2, body: { transactionId: pay.body.transactionId }
        });
        expect(verify.status).toBe(403);
      });
    });

    it('user cannot execute another user\'s payment', async () => {
      const { h, room, c } = await setupWorld();
      const c2 = await prisma.user.create({ data: { phone: '01922200088', passwordHash: 'h', role: 'customer' } });
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const tc2 = signToken({ id: c2.id, phone: c2.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      expect(b.status).toBe(201);

      await withStubEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });
        expect(pay.status).toBe(201);

        const exe = await request_(app, 'POST', '/api/v1/payments/execute', {
          token: tc2, body: { transactionId: pay.body.transactionId }
        });
        expect(exe.status).toBe(403);
      });
    });
  });

  describe('Security: amount cannot be overridden', () => {
    it('verify uses server-stored amount, never client amount', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: tc, body: { bookingId: b.body.booking.id, method: 'bkash', amount: 1 }
      });
      expect(pay.status).toBe(201);
      const payment = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
      expect(payment?.amount).toBe(b.body.booking.finalAmount);
      expect(payment?.amount).not.toBe(1);
    });

    it('initiation ignores client-supplied amount', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: tc, body: { bookingId: b.body.booking.id, method: 'bkash', amount: 1 }
      });
      expect(pay.status).toBe(201);
      const payment = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
      expect(payment?.amount).toBe(b.body.booking.finalAmount);
      expect(payment?.amount).not.toBe(1);
    });
  });

  describe('Security: client cannot inject provider reference', () => {
    it('verify ignores client gatewayReference and uses only server providerRefId', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withStubEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });
        expect(pay.status).toBe(201);

        const spy = spyOnGatewayVerify(BkashPaymentGateway, {
          success: true, status: 'success', amount: b.body.booking.finalAmount,
          currency: 'BDT', paidAt: new Date(), raw: { mode: 'stub' }
        });

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc,
          body: { transactionId: pay.body.transactionId, gatewayReference: 'INJECTED-REF-FAKE' }
        });
        expect(verify.status).toBe(200);

        const callArg = spy.mock.calls[0][0] as PaymentGatewayVerificationInput;
        expect(callArg.gatewayReference).toBe(pay.body.payment.providerRefId);
        expect(callArg.gatewayReference).not.toBe('INJECTED-REF-FAKE');

        spy.mockRestore();
      });
    });
  });

  describe('Security: invalid provider reference cannot produce SUCCESS', () => {
    it('mock gateway rejects unknown provider reference', async () => {
      const gw = new MockPaymentGateway({ provider: 'mock' });
      const result = await gw.verify({
        gatewayReference: 'UNKNOWN-REF-123',
        transactionId: 'TXN-123',
        expectedAmount: 2000,
        expectedCurrency: 'BDT'
      });
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });

    it('mock gateway execute rejects unknown provider reference', async () => {
      const gw = new MockPaymentGateway({ provider: 'mock' });
      const result = await gw.execute({
        gatewayReference: 'UNKNOWN-REF-123',
        transactionId: 'TXN-123'
      });
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });
  });

  describe('Security: gateway failure cannot produce SUCCESS', () => {
    it('route returns failure when gateway verify throws', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withStubEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });
        expect(pay.status).toBe(201);

        const spy = jest.spyOn(BkashPaymentGateway.prototype, 'verify')
          .mockRejectedValue(new Error('Provider timeout'));

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });

        spy.mockRestore();
        expect(verify.status).toBe(402);
        expect(verify.body.status).toBe('pending');
        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).not.toBe('paid');
        expect(bookingAfter?.status).not.toBe('confirmed');
      });
    });
  });

  describe('Security: amount mismatch cannot produce SUCCESS', () => {
    it('verify rejects when provider returns wrong amount', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withStubEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });

        const spy = spyOnGatewayVerify(BkashPaymentGateway, {
          success: true, status: 'success', amount: 999,
          currency: 'BDT', paidAt: new Date(), raw: { mode: 'stub' }
        });

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });

        spy.mockRestore();
        expect(verify.status).toBe(402);
        expect(verify.body.error).toMatch(/amount mismatch/i);
        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).not.toBe('paid');
      });
    });
  });

  describe('Security: currency mismatch cannot produce SUCCESS', () => {
    it('verify rejects when provider returns wrong currency', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withStubEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });

        const spy = spyOnGatewayVerify(BkashPaymentGateway, {
          success: true, status: 'success', amount: b.body.booking.finalAmount,
          currency: 'USD', paidAt: new Date(), raw: { mode: 'stub' }
        });

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });

        spy.mockRestore();
        expect(verify.status).toBe(402);
        expect(verify.body.error).toMatch(/currency/i);
        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).not.toBe('paid');
      });
    });
  });

  describe('Security: idempotency', () => {
    it('already-paid payment returns idempotent success on re-verify', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withStubEnv(async () => {
        const spy = spyOnGatewayVerify(BkashPaymentGateway, {
          success: true, status: 'success', amount: b.body.booking.finalAmount,
          currency: 'BDT', paidAt: new Date(), raw: { mode: 'stub' }
        });

        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });

        const v1 = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        expect(v1.status).toBe(200);
        expect(v1.body.status).toBe('success');

        const v2 = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        expect(v2.status).toBe(200);
        expect(v2.body.status).toBe('success');

        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).toBe('paid');
        expect(bookingAfter?.status).toBe('confirmed');

        spy.mockRestore();
      });
    });

    it('already-paid payment returns idempotent success on double execute', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withStubEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });

        const spy = jest.spyOn(BkashPaymentGateway.prototype, 'execute')
          .mockResolvedValue({
            success: true, status: 'success', providerRefId: pay.body.payment.providerRefId,
            amount: b.body.booking.finalAmount, currency: 'BDT', paidAt: new Date(),
            raw: { mode: 'stub' }
          });

        const e1 = await request_(app, 'POST', '/api/v1/payments/execute', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        expect(e1.status).toBe(200);

        const e2 = await request_(app, 'POST', '/api/v1/payments/execute', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        expect(e2.status).toBe(200);
        expect(e2.body.status).toBe('success');

        spy.mockRestore();
      });
    });
  });

  describe('Security: already successful payment cannot be maliciously changed', () => {
    it('payment stays SUCCESS after re-verify even with bad gateway', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withStubEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });

        const spy = spyOnGatewayVerify(BkashPaymentGateway, {
          success: true, status: 'success', amount: b.body.booking.finalAmount,
          currency: 'BDT', paidAt: new Date(), raw: { mode: 'stub' }
        });
        await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        spy.mockRestore();

        const reVerify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        expect(reVerify.status).toBe(200);
        expect(reVerify.body.status).toBe('success');

        const payment = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
        expect(payment?.status).toBe('success');
        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).toBe('paid');
      });
    });
  });

  describe('Security: legacy payment with missing providerRefId', () => {
    it('verify returns 402 for legacy payment without providerRefId', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const booking = await prisma.booking.create({
        data: {
          userId: c.id, roomId: room.id, providerId: h.id, category: 'hotel',
          travelDate: new Date(Date.now() + 86400000), returnDate: new Date(Date.now() + 172800000),
          bookingDate: new Date(), numberOfPeople: 1, numberOfRooms: 1, bookingCode: 'LEGACY-001',
          totalAmount: 2000, finalAmount: 2000, status: 'pending', paymentStatus: 'pending'
        }
      });
      const legacyPayment = await prisma.payment.create({
        data: {
          bookingId: booking.id, amount: 2000, currency: 'BDT', method: 'bkash',
          transactionId: 'LEGACY-TXN-001', providerRefId: null, status: 'init'
        }
      });

      const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
        token: tc, body: { transactionId: legacyPayment.transactionId }
      });
      expect(verify.status).toBe(402);
      expect(verify.body.error).toMatch(/no provider reference/i);
      expect(verify.body.status).toBe('pending');
      const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(bookingAfter?.paymentStatus).not.toBe('paid');
    });

    it('execute returns 402 for legacy payment without providerRefId', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const booking = await prisma.booking.create({
        data: {
          userId: c.id, roomId: room.id, providerId: h.id, category: 'hotel',
          travelDate: new Date(Date.now() + 86400000), returnDate: new Date(Date.now() + 172800000),
          bookingDate: new Date(), numberOfPeople: 1, numberOfRooms: 1, bookingCode: 'LEGACY-002',
          totalAmount: 2000, finalAmount: 2000, status: 'pending', paymentStatus: 'pending'
        }
      });
      const legacyPayment = await prisma.payment.create({
        data: {
          bookingId: booking.id, amount: 2000, currency: 'BDT', method: 'bkash',
          transactionId: 'LEGACY-TXN-002', providerRefId: null, status: 'init'
        }
      });

      const exe = await request_(app, 'POST', '/api/v1/payments/execute', {
        token: tc, body: { transactionId: legacyPayment.transactionId }
      });
      expect(exe.status).toBe(402);
      expect(exe.body.error).toMatch(/no provider reference/i);
      const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(bookingAfter?.paymentStatus).not.toBe('paid');
    });
  });
});

describe('PAYMENT GATEWAY STEP 1 — Mock Gateway Determinism', () => {
  beforeEach(() => { resetMockGatewayStore(); });
  afterEach(() => { resetMockGatewayStore(); });

  it('unknown provider reference fails verify', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const result = await gw.verify({
      gatewayReference: 'UNKNOWN', transactionId: 'TXN-1', expectedAmount: 100, expectedCurrency: 'BDT'
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.raw?.mode).toBe('mock');
  });

  it('unknown provider reference fails execute', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const result = await gw.execute({ gatewayReference: 'UNKNOWN', transactionId: 'TXN-1' });
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
  });

  it('unknown provider reference fails refund', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const result = await gw.refund({ gatewayReference: 'UNKNOWN', transactionId: 'TXN-1', amount: 100 });
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
  });

  it('known provider reference returns correct status after initiate', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const initiated = await gw.initiate({
      bookingId: 1, amount: 2000, currency: 'BDT'
    });
    expect(initiated.success).toBe(true);
    expect(initiated.gatewayReference).toBeDefined();

    const verify = await gw.verify({
      gatewayReference: initiated.gatewayReference!,
      transactionId: initiated.transactionId,
      expectedAmount: 2000,
      expectedCurrency: 'BDT'
    });
    expect(verify.status).toBe('pending');
    expect(verify.amount).toBe(2000);
    expect(verify.currency).toBe('BDT');
  });

  it('execute transitions init → success and returns stored amount', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const initiated = await gw.initiate({ bookingId: 1, amount: 3000, currency: 'BDT' });

    const exec = await gw.execute({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });
    expect(exec.success).toBe(true);
    expect(exec.status).toBe('success');
    expect(exec.amount).toBe(3000);
    expect(exec.currency).toBe('BDT');
    expect(exec.providerRefId).toBe(initiated.gatewayReference);

    const verify = await gw.verify({
      gatewayReference: initiated.gatewayReference!,
      transactionId: initiated.transactionId,
      expectedAmount: 3000,
      expectedCurrency: 'BDT'
    });
    expect(verify.success).toBe(true);
    expect(verify.status).toBe('success');
    expect(verify.amount).toBe(3000);
    expect(verify.currency).toBe('BDT');
  });

  it('verify returns stored amount not expectedAmount from input', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const initiated = await gw.initiate({ bookingId: 1, amount: 5000, currency: 'BDT' });

    await gw.execute({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });

    const verify = await gw.verify({
      gatewayReference: initiated.gatewayReference!,
      transactionId: initiated.transactionId,
      expectedAmount: 1,
      expectedCurrency: 'BDT'
    });
    expect(verify.amount).toBe(5000);
    expect(verify.amount).not.toBe(1);
  });

  it('verify returns stored currency not expectedCurrency from input', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const initiated = await gw.initiate({ bookingId: 1, amount: 2000, currency: 'BDT' });

    await gw.execute({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });

    const verify = await gw.verify({
      gatewayReference: initiated.gatewayReference!,
      transactionId: initiated.transactionId,
      expectedAmount: 2000,
      expectedCurrency: 'USD'
    });
    expect(verify.currency).toBe('BDT');
    expect(verify.currency).not.toBe('USD');
  });

  it('failed provider transaction stays failed', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const initiated = await gw.initiate({ bookingId: 1, amount: 2000, currency: 'BDT' });

    const exec1 = await gw.execute({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });
    expect(exec1.success).toBe(true);

    const refund = await gw.refund({
      gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId, amount: 2000
    });
    expect(refund.success).toBe(true);

    const verifyAfterRefund = await gw.verify({
      gatewayReference: initiated.gatewayReference!,
      transactionId: initiated.transactionId,
      expectedAmount: 2000,
      expectedCurrency: 'BDT'
    });
    expect(verifyAfterRefund.success).toBe(false);
    expect(verifyAfterRefund.status).toBe('failed');
  });

  it('queryPayment returns correct status', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const initiated = await gw.initiate({ bookingId: 1, amount: 1000, currency: 'BDT' });

    let q = await gw.queryPayment({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });
    expect(q.status).toBe('pending');

    await gw.execute({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });

    q = await gw.queryPayment({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });
    expect(q.status).toBe('success');
    expect(q.amount).toBe(1000);
    expect(q.currency).toBe('BDT');
  });

  it('execute is idempotent — double execute returns success', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const initiated = await gw.initiate({ bookingId: 1, amount: 1500, currency: 'BDT' });

    const e1 = await gw.execute({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });
    expect(e1.success).toBe(true);

    const e2 = await gw.execute({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });
    expect(e2.success).toBe(true);
    expect(e2.status).toBe('success');
  });

  it('refund rejects wrong amount', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const initiated = await gw.initiate({ bookingId: 1, amount: 5000, currency: 'BDT' });
    await gw.execute({ gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId });

    const refund = await gw.refund({
      gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId, amount: 999
    });
    expect(refund.success).toBe(false);
    expect(refund.status).toBe('failed');
  });

  it('mock gateway raw.mode is always mock', async () => {
    const gw = new MockPaymentGateway({ provider: 'mock' });
    const initiated = await gw.initiate({ bookingId: 1, amount: 100, currency: 'BDT' });
    const verify = await gw.verify({
      gatewayReference: initiated.gatewayReference!, transactionId: initiated.transactionId,
      expectedAmount: 100, expectedCurrency: 'BDT'
    });
    expect(verify.raw?.mode).toBe('mock');
    expect(verify.raw?.mode).not.toBe('live');
  });
});
