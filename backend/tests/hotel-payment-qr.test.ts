import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';
import hotelRoutes from '../src/routes/hotel.routes';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';
import hotelRoomRoutes from '../src/routes/hotel-room.routes';
import hotelBookingRoutes from '../src/routes/hotel-booking.routes';
import paymentRoutes from '../src/routes/payment.routes';
import qrRoutes from '../src/routes/qr.routes';
import { BkashPaymentGateway, NagadPaymentGateway, SSLCommerzPaymentGateway, MockPaymentGateway, BkashSandboxGateway } from '../src/utils/payment-gateways';
import { PaymentGatewayVerificationResult } from '../src/utils/payment-gateway';
import serviceBookingRoutes from '../src/routes/service-booking.routes';

jest.setTimeout(30000);

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
  app.use('/api/v1/qr', qrRoutes);
  app.use('/api/v1/services', serviceBookingRoutes);
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

function withBkashEnv(callback: () => Promise<void>) {
  snapshotEnv(['PAYMENT_MODE', 'BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USER_NAME', 'BKASH_PASSWORD', 'BKASH_BASE_URL', 'BKASH_API_KEY', 'BKASH_SECRET_KEY']);
  process.env.PAYMENT_MODE = 'sandbox';
  process.env.BKASH_APP_KEY = 'sandbox_test_key';
  process.env.BKASH_APP_SECRET = 'sandbox_test_secret';
  process.env.BKASH_USER_NAME = 'sandbox_user';
  process.env.BKASH_PASSWORD = 'sandbox_pass';
  process.env.BKASH_BASE_URL = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
  process.env.BKASH_API_KEY = 'sandbox_test_key';
  process.env.BKASH_SECRET_KEY = 'sandbox_test_secret';
  return callback().finally(() => restoreEnv(['PAYMENT_MODE', 'BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USER_NAME', 'BKASH_PASSWORD', 'BKASH_BASE_URL', 'BKASH_API_KEY', 'BKASH_SECRET_KEY']));
}

function spyOnGatewayVerify<T extends { verify: (input: any) => Promise<PaymentGatewayVerificationResult> }>(
  GatewayClass: new (config: any) => T,
  result: PaymentGatewayVerificationResult
) {
  const spy = jest.spyOn(GatewayClass.prototype, 'verify').mockResolvedValue(result);
  return spy;
}

describe('STEP 9 — Payment Security', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  afterEach(async () => { await cleanup(); });

  describe('Phase 1 — Gateway mode labels', () => {
    it('bkash stub initiate raw.mode is stub not live', async () => {
      process.env.BKASH_API_KEY = 'test';
      process.env.BKASH_SECRET_KEY = 'test';
      process.env.BKASH_BASE_URL = 'https://sandbox.bka.sh';
      const gw = new BkashPaymentGateway({ provider: 'bkash', apiKey: 'test', apiSecret: 'test', baseUrl: 'https://sandbox.bka.sh' });
      const result = await gw.initiate({ bookingId: 1, amount: 100, currency: 'BDT' });
      expect(result.raw?.mode).toBe('stub');
      expect(result.raw?.mode).not.toBe('live');
      delete process.env.BKASH_API_KEY;
      delete process.env.BKASH_SECRET_KEY;
      delete process.env.BKASH_BASE_URL;
    });

    it('nagad stub initiate raw.mode is stub not live', async () => {
      process.env.NAGAD_API_KEY = 'test';
      process.env.NAGAD_SECRET_KEY = 'test';
      process.env.NAGAD_BASE_URL = 'https://sandbox.nagad.com';
      const gw = new NagadPaymentGateway({ provider: 'nagad', apiKey: 'test', apiSecret: 'test', baseUrl: 'https://sandbox.nagad.com' });
      const result = await gw.initiate({ bookingId: 1, amount: 100, currency: 'BDT' });
      expect(result.raw?.mode).toBe('stub');
      expect(result.raw?.mode).not.toBe('live');
      delete process.env.NAGAD_API_KEY;
      delete process.env.NAGAD_SECRET_KEY;
      delete process.env.NAGAD_BASE_URL;
    });

    it('sslcommerz stub initiate raw.mode is stub not live', async () => {
      process.env.SSLCOMMERZ_STORE_ID = 'test';
      process.env.SSLCOMMERZ_STORE_PASSWORD = 'test';
      process.env.SSLCOMMERZ_BASE_URL = 'https://sandbox.sslcommerz.com';
      const gw = new SSLCommerzPaymentGateway({ provider: 'sslcommerz', apiKey: 'test', apiSecret: 'test', baseUrl: 'https://sandbox.sslcommerz.com' });
      const result = await gw.initiate({ bookingId: 1, amount: 100, currency: 'BDT' });
      expect(result.raw?.mode).toBe('stub');
      expect(result.raw?.mode).not.toBe('live');
      delete process.env.SSLCOMMERZ_STORE_ID;
      delete process.env.SSLCOMMERZ_STORE_PASSWORD;
      delete process.env.SSLCOMMERZ_BASE_URL;
    });

    it('mock gateway raw.mode is mock', async () => {
      const gw = new MockPaymentGateway({ provider: 'mock' });
      const result = await gw.verify({ gatewayReference: 'TX', transactionId: 'TX', expectedAmount: 100, expectedCurrency: 'BDT' });
      expect(result.raw?.mode).toBe('mock');
    });
  });

  describe('Phase 1B — Stub gateway verify() fails closed', () => {
    it('BkashPaymentGateway.verify() throws for production use', async () => {
      const gw = new BkashPaymentGateway({ provider: 'bkash', apiKey: 'test', apiSecret: 'test', baseUrl: 'https://sandbox.bka.sh' });
      await expect(gw.verify({ gatewayReference: 'TX', transactionId: 'TX', expectedAmount: 100, expectedCurrency: 'BDT' })).rejects.toThrow(/not implemented for production use/i);
    });

    it('NagadPaymentGateway.verify() throws for production use', async () => {
      const gw = new NagadPaymentGateway({ provider: 'nagad', apiKey: 'test', apiSecret: 'test', baseUrl: 'https://sandbox.nagad.com' });
      await expect(gw.verify({ gatewayReference: 'TX', transactionId: 'TX', expectedAmount: 100, expectedCurrency: 'BDT' })).rejects.toThrow(/not implemented for production use/i);
    });

    it('SSLCommerzPaymentGateway.verify() throws for production use', async () => {
      const gw = new SSLCommerzPaymentGateway({ provider: 'sslcommerz', apiKey: 'test', apiSecret: 'test', baseUrl: 'https://sandbox.sslcommerz.com' });
      await expect(gw.verify({ gatewayReference: 'TX', transactionId: 'TX', expectedAmount: 100, expectedCurrency: 'BDT' })).rejects.toThrow(/not implemented for production use/i);
    });
  });

  describe('Phase 2 — Server-side amount enforcement', () => {
    it('initiation ignores client-supplied amount and uses booking.finalAmount', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      expect(b.status).toBe(201);
      const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId: b.body.booking.id, method: 'bkash', amount: 1 }
      });
      expect(pay.status).toBe(201);
      const payment = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
      expect(payment?.amount).toBe(b.body.booking.finalAmount);
      expect(payment?.amount).not.toBe(1);
    });
  });

  describe('Phase 3 — Fail closed: gateway unavailable', () => {
    it('verify returns failure when gateway is not configured (no env vars)', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      snapshotEnv(['USE_MOCK_PAYMENT', 'PAYMENT_MODE', 'BKASH_API_KEY', 'BKASH_SECRET_KEY', 'BKASH_BASE_URL', 'BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USER_NAME', 'BKASH_PASSWORD']);
      delete process.env.USE_MOCK_PAYMENT;
      delete process.env.PAYMENT_MODE;
      delete process.env.BKASH_API_KEY;
      delete process.env.BKASH_SECRET_KEY;
      delete process.env.BKASH_BASE_URL;
      delete process.env.BKASH_APP_KEY;
      delete process.env.BKASH_APP_SECRET;
      delete process.env.BKASH_USER_NAME;
      delete process.env.BKASH_PASSWORD;
      try {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc,
          body: { bookingId: b.body.booking.id, method: 'bkash', amount: 2000 }
        });
        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc,
          body: { transactionId: pay.body.transactionId }
        });
        expect(verify.status).toBe(402);
        expect(verify.body.status).toBe('pending');

        // Booking must remain unpaid
        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).not.toBe('paid');
        expect(bookingAfter?.status).not.toBe('confirmed');
      } finally {
        restoreEnv(['USE_MOCK_PAYMENT', 'PAYMENT_MODE', 'BKASH_API_KEY', 'BKASH_SECRET_KEY', 'BKASH_BASE_URL', 'BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USER_NAME', 'BKASH_PASSWORD']);
      }
    });

    it('verify does not mark booking paid when provider verification fails', async () => {
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
        token: tc,
        body: { bookingId: b.body.booking.id, method: 'bkash', amount: 2000 }
      });

      await withBkashEnv(async () => {
        const spy = spyOnGatewayVerify(BkashSandboxGateway, {
          success: false,
          status: 'failed',
          raw: { mode: 'sandbox' }
        });

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc,
          body: { transactionId: pay.body.transactionId }
        });

        spy.mockRestore();

        expect(verify.status).toBe(402);
        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).not.toBe('paid');
      });
    });
  });

  describe('Phase 4 — Amount mismatch protection', () => {
    it('verify fails when provider returns mismatched amount', async () => {
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
        token: tc,
        body: { bookingId: b.body.booking.id, method: 'bkash', amount: 2000 }
      });

      await withBkashEnv(async () => {
        const spy = spyOnGatewayVerify(BkashSandboxGateway, {
          success: true,
          status: 'success',
          amount: 999,
          currency: 'BDT',
          paidAt: new Date(),
          raw: { mode: 'sandbox' }
        });

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc,
          body: { transactionId: pay.body.transactionId }
        });

        spy.mockRestore();

        expect(verify.status).toBe(402);
        expect(verify.body.error).toMatch(/amount mismatch/i);

        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).not.toBe('paid');
      });
    });
  });

  describe('Phase 5 — Successful verification with configured gateway', () => {
    it('verify succeeds when gateway confirms correct amount', async () => {
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
        token: tc,
        body: { bookingId: b.body.booking.id, method: 'bkash', amount: 2000 }
      });

      await withBkashEnv(async () => {
        const spy = spyOnGatewayVerify(BkashSandboxGateway, {
          success: true,
          status: 'success',
          amount: b.body.booking.finalAmount,
          currency: 'BDT',
          paidAt: new Date(),
          raw: { mode: 'sandbox' }
        });

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc,
          body: { transactionId: pay.body.transactionId }
        });

        spy.mockRestore();

        expect(verify.status).toBe(200);
        expect(verify.body.status).toBe('success');
        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).toBe('paid');
        expect(bookingAfter?.status).toBe('confirmed');
      });
    });
  });

  describe('Phase 6 — Unknown / arbitrary transactionId', () => {
    it('verify returns 404 for unknown transactionId', async () => {
      const tc = signToken({ id: 1, phone: '01911100001', role: 'customer' });
      const app = createApp();
      const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
        token: tc,
        body: { transactionId: 'TXN-DOES-NOT-EXIST' }
      });
      expect(verify.status).toBe(404);
    });
  });

  describe('Phase 7 — Authorization', () => {
    it('customer cannot verify another customer payment', async () => {
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
      const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId: b.body.booking.id, method: 'bkash', amount: 2000 }
      });
      const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
        token: tc2,
        body: { transactionId: pay.body.transactionId }
      });
      expect(verify.status).toBe(403);
    });
  });

  describe('Phase 8 — Idempotency', () => {
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
      const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId: b.body.booking.id, method: 'bkash', amount: 2000 }
      });

      await withBkashEnv(async () => {
        const spy = spyOnGatewayVerify(BkashSandboxGateway, {
          success: true,
          status: 'success',
          amount: b.body.booking.finalAmount,
          currency: 'BDT',
          paidAt: new Date(),
          raw: { mode: 'sandbox' }
        });

        const verify1 = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc,
          body: { transactionId: pay.body.transactionId }
        });
        expect(verify1.status).toBe(200);

        const verify2 = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc,
          body: { transactionId: pay.body.transactionId }
        });
        expect(verify2.status).toBe(200);
        expect(verify2.body.status).toBe('success');

        spy.mockRestore();
      });
    });
  });

  describe('Phase 9 — Booking state transitions', () => {
    it('cannot verify payment for cancelled booking', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      await prisma.booking.update({ where: { id: b.body.booking.id }, data: { status: 'cancelled' } });
      const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId: b.body.booking.id, method: 'bkash', amount: 2000 }
      });
      const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
        token: tc,
        body: { transactionId: pay.body.transactionId }
      });
      expect(verify.status).toBe(400);
    });
  });

  describe('Phase 10 — QR generation after payment', () => {
    it('verifies payment and confirms booking + generates QR', async () => {
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
        token: tc,
        body: { bookingId: b.body.booking.id, method: 'bkash', amount: 2000 }
      });

      await withBkashEnv(async () => {
        const spy = spyOnGatewayVerify(BkashSandboxGateway, {
          success: true,
          status: 'success',
          amount: b.body.booking.finalAmount,
          currency: 'BDT',
          paidAt: new Date(),
          raw: { mode: 'sandbox' }
        });

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        expect(verify.status).toBe(200);
        spy.mockRestore();

        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).toBe('paid');

        const qrRes = await request_(app, 'GET', `/api/v1/qr/generate/${b.body.booking.id}`, { token: tc });
        expect(qrRes.status).toBe(200);
        expect(qrRes.body.qrObject).toBeDefined();
        expect(qrRes.body.qrDataUrl).toBeDefined();
      });
    });
  });

  describe('Phase 11 — Direct booking settlement', () => {
    it('direct-source hotel booking generates no commission settlement', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1, source: 'DIRECT' }
      });
      expect(b.status).toBe(201);
      expect(b.body.booking.source).toBe('DIRECT');

      await withBkashEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'cash', amount: 2000 }
        });
        await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });

        const settlements = await prisma.settlement.count({ where: { bookingId: b.body.booking.id } });
        expect(settlements).toBe(0);
      });
    });
  });

  describe('Phase 12 — QR verification', () => {
    it('verifies QR token via /qr/verify endpoint', async () => {
      const { h, room, c, v } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const tv = signToken({ id: v.id, phone: v.phone, role: 'vendor' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId: b.body.booking.id, method: 'bkash', amount: 2000 }
      });

      await withBkashEnv(async () => {
        const spy = spyOnGatewayVerify(BkashSandboxGateway, {
          success: true,
          status: 'success',
          amount: b.body.booking.finalAmount,
          currency: 'BDT',
          paidAt: new Date(),
          raw: { mode: 'sandbox' }
        });

        await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        spy.mockRestore();

        const qrRes = await request_(app, 'GET', `/api/v1/qr/generate/${b.body.booking.id}`, { token: tc });

        const verify = await request_(app, 'POST', '/api/v1/qr/verify', {
          token: tv,
          body: { qrData: qrRes.body.qrObject }
        });
        expect(verify.status).toBe(200);
      });
    });
  });

  describe('Phase 13 — QR forgery rejection', () => {
    it('rejects forged QR (invalid HMAC signature)', async () => {
      const { v } = await setupWorld();
      const tv = signToken({ id: v.id, phone: v.phone, role: 'vendor' });
      const app = createApp();
      const verify = await request_(app, 'POST', '/api/v1/qr/verify', {
        token: tv,
        body: { qrData: { payload: { bkg: 'fake', tp: 'fake' }, signature: 'forged-sig' } }
      });
      expect(verify.status).toBe(400);
    });
  });
});

describe('STEP 9-B — Payment Provider Abstraction & bKash Sandbox', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  afterEach(async () => { await cleanup(); });

  describe('Sandbox integration', () => {
    it('payment initiate creates providerRefId when gateway succeeds', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      expect(b.status).toBe(201);

      await withBkashEnv(async () => {
        const spy = jest.spyOn(BkashSandboxGateway.prototype, 'initiate').mockResolvedValue({
          success: true,
          transactionId: 'TXN-123',
          gatewayReference: 'BKASH-PAYMENT-001',
          checkoutUrl: 'https://sandbox.bka.sh/BKASH-PAYMENT-001',
          expiresAt: new Date(Date.now() + 900000),
          raw: { mode: 'sandbox', provider: 'bkash' }
        });

        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc,
          body: { bookingId: b.body.booking.id, method: 'bkash', amount: b.body.booking.finalAmount }
        });
        expect(pay.status).toBe(201);
        expect(pay.body.payment.providerRefId).toBe('BKASH-PAYMENT-001');
        expect(pay.body.payment.currency).toBe('BDT');
        expect(pay.body.paymentUrl).toBe('https://sandbox.bka.sh/BKASH-PAYMENT-001');

        const payment = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
        expect(payment?.providerRefId).toBe('BKASH-PAYMENT-001');
        expect(payment?.currency).toBe('BDT');

        spy.mockRestore();
      });
    });

    it('sandbox gateway refuses to run when PAYMENT_MODE is not sandbox', async () => {
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

  describe('Payment execution flow', () => {
    it('execute endpoint processes payment when gateway confirms', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withBkashEnv(async () => {
        const initiateSpy = jest.spyOn(BkashSandboxGateway.prototype, 'initiate').mockResolvedValue({
          success: true, transactionId: 'TXN-EXE', gatewayReference: 'BKASH-EXE-001',
          checkoutUrl: 'https://sandbox.bka.sh/BKASH-EXE-001',
          raw: { mode: 'sandbox' }
        });
        const executeSpy = jest.spyOn(BkashSandboxGateway.prototype, 'execute').mockResolvedValue({
          success: true, status: 'success', providerRefId: 'TRX-BKASH-001',
          amount: b.body.booking.finalAmount, currency: 'BDT', paidAt: new Date(),
          raw: { mode: 'sandbox' }
        });

        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });
        expect(pay.status).toBe(201);

        const exe = await request_(app, 'POST', '/api/v1/payments/execute', {
          token: tc,
          body: { transactionId: pay.body.transactionId, paymentID: 'BKASH-EXE-001' }
        });
        expect(exe.status).toBe(200);
        expect(exe.body.status).toBe('success');

        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).toBe('paid');
        expect(bookingAfter?.status).toBe('confirmed');

        const payment = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
        expect(payment?.providerRefId).toBe('TRX-BKASH-001');
        expect(payment?.status).toBe('success');

        initiateSpy.mockRestore();
        executeSpy.mockRestore();
      });
    });

    it('execute rejects when paymentID does not match stored providerRefId', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withBkashEnv(async () => {
        const spy = jest.spyOn(BkashSandboxGateway.prototype, 'initiate').mockResolvedValue({
          success: true, transactionId: 'TXN-MISMATCH', gatewayReference: 'BKASH-LEGIT-001',
          checkoutUrl: 'https://sandbox.bka.sh/BKASH-LEGIT-001',
          raw: { mode: 'sandbox' }
        });

        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });
        expect(pay.status).toBe(201);

        const exe = await request_(app, 'POST', '/api/v1/payments/execute', {
          token: tc,
          body: { transactionId: pay.body.transactionId, paymentID: 'BKASH-OTHER-BOOKING-001' }
        });
        expect(exe.status).toBe(400);
        expect(exe.body.error).toMatch(/does not match/i);

        spy.mockRestore();
      });
    });

    it('execute is idempotent — double execute returns current state', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withBkashEnv(async () => {
        const initSpy = jest.spyOn(BkashSandboxGateway.prototype, 'initiate').mockResolvedValue({
          success: true, transactionId: 'TXN-IDEMP', gatewayReference: 'BKASH-IDEMP-001',
          checkoutUrl: 'https://sandbox.bka.sh/BKASH-IDEMP-001',
          raw: { mode: 'sandbox' }
        });
        const exeSpy = jest.spyOn(BkashSandboxGateway.prototype, 'execute').mockResolvedValue({
          success: true, status: 'success', providerRefId: 'TRX-IDEMP',
          amount: b.body.booking.finalAmount, currency: 'BDT', paidAt: new Date(),
          raw: { mode: 'sandbox' }
        });

        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });

        const exe1 = await request_(app, 'POST', '/api/v1/payments/execute', {
          token: tc, body: { transactionId: pay.body.transactionId, paymentID: 'BKASH-IDEMP-001' }
        });
        expect(exe1.status).toBe(200);

        const exe2 = await request_(app, 'POST', '/api/v1/payments/execute', {
          token: tc, body: { transactionId: pay.body.transactionId, paymentID: 'BKASH-IDEMP-001' }
        });
        expect(exe2.status).toBe(200);

        initSpy.mockRestore();
        exeSpy.mockRestore();
      });
    });
  });

  describe('Payment query', () => {
    it('query endpoint returns gateway status without mutating', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withBkashEnv(async () => {
        const initSpy = jest.spyOn(BkashSandboxGateway.prototype, 'initiate').mockResolvedValue({
          success: true, transactionId: 'TXN-Q', gatewayReference: 'BKASH-Q-001',
          checkoutUrl: 'https://sandbox.bka.sh/BKASH-Q-001',
          raw: { mode: 'sandbox' }
        });
        const querySpy = jest.spyOn(BkashSandboxGateway.prototype, 'queryPayment').mockResolvedValue({
          success: false, status: 'pending',
          raw: { mode: 'sandbox' }
        });

        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });
        expect(pay.status).toBe(201);

        const q = await request_(app, 'POST', '/api/v1/payments/query', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        expect(q.status).toBe(200);
        expect(q.body.status).toBe('pending');

        const bookingAfter = await prisma.booking.findUnique({ where: { id: b.body.booking.id } });
        expect(bookingAfter?.paymentStatus).toBe('pending');

        initSpy.mockRestore();
        querySpy.mockRestore();
      });
    });

    it('query returns 404 for unknown transaction', async () => {
      const tc = signToken({ id: 1, phone: '01911100001', role: 'customer' });
      const app = createApp();
      const q = await request_(app, 'POST', '/api/v1/payments/query', {
        token: tc, body: { transactionId: 'UNKNOWN-TXN' }
      });
      expect(q.status).toBe(404);
    });
  });

  describe('Secret/configuration safety', () => {
    it('gateway credentials are never exposed in payment records', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withBkashEnv(async () => {
        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash', amount: b.body.booking.finalAmount }
        });
        expect(pay.status).toBe(201);

        const gwResp = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
        expect(gwResp?.gatewayResponse).toBeDefined();
        const respStr = gwResp!.gatewayResponse!;
        expect(respStr.toLowerCase()).not.toContain('app_secret');
        expect(respStr.toLowerCase()).not.toContain('sandbox_test_secret');
        expect(respStr.toLowerCase()).not.toContain('password');
      });
    });

    it('env vars are not leaked through error messages', async () => {
      delete process.env.BKASH_APP_KEY;
      delete process.env.BKASH_APP_SECRET;
      delete process.env.BKASH_USER_NAME;
      delete process.env.BKASH_PASSWORD;
      process.env.PAYMENT_MODE = 'sandbox';

      const gw = new BkashSandboxGateway({ provider: 'bkash' });
      try {
        await gw.verify({ gatewayReference: 'X', transactionId: 'Y', expectedAmount: 100, expectedCurrency: 'BDT' });
      } catch (e: any) {
        expect(e.message).not.toContain('app_key');
        expect(e.message).not.toContain('sandbox_test');
      }
    });
  });

  describe('Already-paid booking', () => {
    it('cannot initiate payment for already-paid booking', async () => {
      const { h, room, c } = await setupWorld();
      const tc = signToken({ id: c.id, phone: c.phone, role: 'customer' });
      const app = createApp();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tc,
        body: { hotelId: h.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      await withBkashEnv(async () => {
        const spy = spyOnGatewayVerify(BkashSandboxGateway, {
          success: true, status: 'success', amount: b.body.booking.finalAmount,
          currency: 'BDT', paidAt: new Date(), raw: { mode: 'sandbox' }
        });

        const pay = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });
        await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        spy.mockRestore();

        const pay2 = await request_(app, 'POST', '/api/v1/payments/initiate', {
          token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
        });
        expect(pay2.status).toBe(400);
        expect(pay2.body.error).toMatch(/already paid/i);
      });
    });
  });

  describe('All gateway classes implement queryPayment', () => {
    it('mock gateway queryPayment returns failed for unknown reference', async () => {
      const gw = new MockPaymentGateway({ provider: 'mock' });
      const result = await gw.queryPayment({ gatewayReference: 'X', transactionId: 'Y' });
      expect(result.status).toBe('failed');
      expect(result.raw?.mode).toBe('mock');
    });

    it('stub bkash gateway queryPayment returns unknown', async () => {
      const gw = new BkashPaymentGateway({ provider: 'bkash', apiKey: 'k', apiSecret: 's', baseUrl: 'https://x' });
      const result = await gw.queryPayment({ gatewayReference: 'X', transactionId: 'Y' });
      expect(result.status).toBe('unknown');
    });

    it('stub nagad gateway queryPayment returns unknown', async () => {
      const gw = new NagadPaymentGateway({ provider: 'nagad', apiKey: 'k', apiSecret: 's', baseUrl: 'https://x' });
      const result = await gw.queryPayment({ gatewayReference: 'X', transactionId: 'Y' });
      expect(result.status).toBe('unknown');
    });

    it('stub sslcommerz gateway queryPayment returns unknown', async () => {
      const gw = new SSLCommerzPaymentGateway({ provider: 'sslcommerz', apiKey: 'k', apiSecret: 's', baseUrl: 'https://x' });
      const result = await gw.queryPayment({ gatewayReference: 'X', transactionId: 'Y' });
      expect(result.status).toBe('unknown');
    });
  });

  describe('Currency enforcement', () => {
    it('verify rejects payment when currency is not BDT', async () => {
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
        token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
      });

      await withBkashEnv(async () => {
        const spy = spyOnGatewayVerify(BkashSandboxGateway, {
          success: true, status: 'success', amount: b.body.booking.finalAmount,
          currency: 'USD', paidAt: new Date(), raw: { mode: 'sandbox' }
        });

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        spy.mockRestore();
        expect(verify.status).toBe(402);
        expect(verify.body.error).toMatch(/currency/i);
      });
    });
  });

  describe('Client amount manipulation defense', () => {
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
        token: tc, body: { bookingId: b.body.booking.id, method: 'bkash' }
      });

      const serverAmount = b.body.booking.finalAmount;

      await withBkashEnv(async () => {
        const spy = spyOnGatewayVerify(BkashSandboxGateway, {
          success: true, status: 'success', amount: serverAmount,
          currency: 'BDT', paidAt: new Date(), raw: { mode: 'sandbox' }
        });

        const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
          token: tc, body: { transactionId: pay.body.transactionId }
        });
        spy.mockRestore();

        expect(verify.status).toBe(200);
        const payment = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
        expect(payment?.amount).toBe(serverAmount);
      });
    });
  });
});