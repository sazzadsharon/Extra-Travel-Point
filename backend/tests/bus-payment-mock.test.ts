import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';
import transportRoutes from '../src/routes/transport.routes';
import bookingRoutes from '../src/routes/booking.routes';
import paymentRoutes from '../src/routes/payment.routes';
import authRoutes from '../src/routes/auth.routes';
import { MockPaymentGateway, resetMockGatewayStore, resolvePaymentGateway } from '../src/utils/payment-gateways';

function signToken(user: { id: number; phone: string; role: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(user, secret, { expiresIn: '1h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/transport', transportRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  return app;
}

function request(app: express.Express, method: string, path: string, opts: { token?: string; body?: any } = {}): Promise<{ status: number; body: any }> {
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

async function setupBusWorld() {
  await cleanup();
  const vendor = await prisma.user.create({
    data: { phone: '01911000001', passwordHash: 'hash', role: 'vendor', fullName: 'Vendor Owner' }
  });
  const provider = await prisma.serviceProvider.create({
    data: {
      userId: vendor.id,
      businessName: 'Green Line',
      category: 'bus',
      description: 'AC bus operator',
      address: 'Gabtoli, Dhaka',
      city: 'Dhaka',
      phone: '01711000001',
      status: 'APPROVED',
      isVerified: true,
      isActive: true
    }
  });
  const bus = await prisma.service.create({
    data: {
      providerId: provider.id,
      name: 'Dhaka -> Cox\'s Bazar Express',
      category: 'bus',
      description: 'Direct AC coach',
      route: 'Dhaka -> Cox\'s Bazar',
      price: 1200,
      currency: 'BDT',
      capacity: 40,
      status: 'ACTIVE',
      isActive: true
    }
  });
  await prisma.serviceAvailability.create({
    data: {
      serviceId: bus.id,
      date: new Date('2026-09-15'),
      startTime: '08:00',
      endTime: '14:00',
      capacity: 40,
      isActive: true
    }
  });
  const customer = await prisma.user.create({
    data: { phone: '01811000001', passwordHash: 'hash', role: 'customer', fullName: 'Cust One' }
  });
  const otherCustomer = await prisma.user.create({
    data: { phone: '01811000002', passwordHash: 'hash', role: 'customer', fullName: 'Cust Two' }
  });
  return { vendor, provider, bus, customer, otherCustomer };
}

async function createBusBooking(app: express.Express, token: string, bus: { providerId: number; id: number }) {
  const seatsRes = await request(app, 'GET', `/api/v1/transport/buses/${bus.id}/seats?date=2026-09-15`, { token });
  const freeSeats = (seatsRes.body.seats as Array<{ seatNumber: string; isAvailable: boolean }>)
    .filter(s => s.isAvailable)
    .slice(0, 1)
    .map(s => s.seatNumber);

  const res = await request(app, 'POST', '/api/v1/bookings', {
    token,
    body: {
      providerId: bus.providerId,
      serviceId: bus.id,
      category: 'bus',
      bookingDate: '2026-09-10',
      travelDate: '2026-09-15',
      numberOfPeople: 1,
      seatNumbers: freeSeats,
      passengers: [{ name: 'P One', email: 'p1@example.com', phone: '01711000001', seatNumber: freeSeats[0] }],
      route: 'Dhaka -> Cox\'s Bazar'
    }
  });
  return { bookingId: res.body.booking.id, booking: res.body.booking, freeSeats };
}

describe('Bus Payment Mock Gateway (PAYMENT_MODE=mock)', () => {
  jest.setTimeout(30000);
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => { resetMockGatewayStore(); });
  afterEach(async () => {
    resetMockGatewayStore();
    await cleanup();
  });

  describe('Full mock payment flow', () => {
    it('initiate → verify → booking paid → ticket accessible', async () => {
      const { bus, customer } = await setupBusWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const app = createApp();

      const { bookingId } = await createBusBooking(app, tc, bus);

      const pay = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId, method: 'mock' }
      });
      expect(pay.status).toBe(201);
      expect(pay.body.transactionId).toBeDefined();
      expect(pay.body.paymentUrl).toBeDefined();

      const verify = await request(app, 'POST', '/api/v1/payments/verify', {
        token: tc,
        body: { transactionId: pay.body.transactionId }
      });
      expect(verify.status).toBe(200);
      expect(verify.body.status).toBe('success');

      const bookingAfter = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(bookingAfter?.paymentStatus).toBe('paid');
      expect(bookingAfter?.status).toBe('confirmed');

      const ticketRes = await request(app, 'GET', `/api/v1/bookings/${bookingId}/ticket`, { token: tc });
      expect(ticketRes.status).toBe(200);
      expect(ticketRes.body.qr).toBeDefined();
      expect(ticketRes.body.qr.object).toBeDefined();
    });

    it('ticket returns 402 before payment is verified', async () => {
      const { bus, customer } = await setupBusWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const app = createApp();

      const { bookingId } = await createBusBooking(app, tc, bus);

      const pay = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId, method: 'mock' }
      });
      expect(pay.status).toBe(201);

      const ticketBeforeVerify = await request(app, 'GET', `/api/v1/bookings/${bookingId}/ticket`, { token: tc });
      expect(ticketBeforeVerify.status).toBe(402);
      expect(ticketBeforeVerify.body.error).toMatch(/payment is verified/i);
    });

    it('server-side amount enforcement — client-supplied amount is ignored', async () => {
      const { bus, customer } = await setupBusWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const app = createApp();

      const { bookingId, booking } = await createBusBooking(app, tc, bus);
      const serverAmount = booking.finalAmount;

      const pay = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId, method: 'mock', amount: 1 }
      });
      expect(pay.status).toBe(201);

      const payment = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
      expect(payment?.amount).toBe(serverAmount);
      expect(payment?.amount).not.toBe(1);
    });

    it('another user cannot verify a mock payment', async () => {
      const { bus, customer, otherCustomer } = await setupBusWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const tc2 = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: otherCustomer.role });
      const app = createApp();

      const { bookingId } = await createBusBooking(app, tc, bus);

      const pay = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId, method: 'mock' }
      });
      expect(pay.status).toBe(201);

      const verify = await request(app, 'POST', '/api/v1/payments/verify', {
        token: tc2,
        body: { transactionId: pay.body.transactionId }
      });
      expect(verify.status).toBe(403);
      expect(verify.body.error).toMatch(/access denied/i);
    });

    it('re-verify on already-paid booking returns idempotent success', async () => {
      const { bus, customer } = await setupBusWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const app = createApp();

      const { bookingId } = await createBusBooking(app, tc, bus);

      const pay = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId, method: 'mock' }
      });
      expect(pay.status).toBe(201);

      const verify1 = await request(app, 'POST', '/api/v1/payments/verify', {
        token: tc,
        body: { transactionId: pay.body.transactionId }
      });
      expect(verify1.status).toBe(200);

      const verify2 = await request(app, 'POST', '/api/v1/payments/verify', {
        token: tc,
        body: { transactionId: pay.body.transactionId }
      });
      expect(verify2.status).toBe(200);
      expect(verify2.body.status).toBe('success');

      const paymentAfter = await prisma.payment.findUnique({ where: { transactionId: pay.body.transactionId } });
      expect(paymentAfter?.status).toBe('success');
    });

    it('mock gateway refuses in production NODE_ENV', () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        expect(() => resolvePaymentGateway('mock', { provider: 'mock' })).toThrow(/not allowed in production/i);
      } finally {
        process.env.NODE_ENV = original;
      }
    });

    it('cannot initiate payment for already-paid booking', async () => {
      const { bus, customer } = await setupBusWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const app = createApp();

      const { bookingId } = await createBusBooking(app, tc, bus);

      const pay1 = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId, method: 'mock' }
      });
      expect(pay1.status).toBe(201);

      await request(app, 'POST', '/api/v1/payments/verify', {
        token: tc,
        body: { transactionId: pay1.body.transactionId }
      });

      const pay2 = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: tc,
        body: { bookingId, method: 'mock' }
      });
      expect(pay2.status).toBe(400);
      expect(pay2.body.error).toMatch(/already paid/i);
    });

    it('cannot verify payment for unknown transactionId', async () => {
      const { customer } = await setupBusWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const app = createApp();

      const verify = await request(app, 'POST', '/api/v1/payments/verify', {
        token: tc,
        body: { transactionId: 'TXN-DOES-NOT-EXIST' }
      });
      expect(verify.status).toBe(404);
    });

    it('cannot initiate payment without authentication', async () => {
      const { bus, customer } = await setupBusWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const app = createApp();

      const { bookingId } = await createBusBooking(app, tc, bus);

      const pay = await request(app, 'POST', '/api/v1/payments/initiate', {
        body: { bookingId, method: 'mock' }
      });
      expect(pay.status).toBe(401);
    });
  });

  describe('Mock gateway unit-level behaviors', () => {
    it('MockPaymentGateway.initiate returns success with gatewayReference', async () => {
      const gw = new MockPaymentGateway({ provider: 'mock' });
      const result = await gw.initiate({ bookingId: 1, amount: 1200, currency: 'BDT' });
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.gatewayReference).toBeDefined();
      expect(result.raw?.mode).toBe('mock');
    });

    it('MockPaymentGateway.execute transitions init → success', async () => {
      const gw = new MockPaymentGateway({ provider: 'mock' });
      const initiated = await gw.initiate({ bookingId: 1, amount: 1200, currency: 'BDT' });
      const executed = await gw.execute({
        gatewayReference: initiated.gatewayReference!,
        transactionId: initiated.transactionId
      });
      expect(executed.success).toBe(true);
      expect(executed.status).toBe('success');
      expect(executed.amount).toBe(1200);
    });

    it('MockPaymentGateway verify returns pending before execute, success after', async () => {
      const gw = new MockPaymentGateway({ provider: 'mock' });
      const initiated = await gw.initiate({ bookingId: 1, amount: 1200, currency: 'BDT' });

      const beforeExecute = await gw.verify({
        gatewayReference: initiated.gatewayReference!,
        transactionId: initiated.transactionId,
        expectedAmount: 1200,
        expectedCurrency: 'BDT'
      });
      expect(beforeExecute.status).toBe('pending');

      await gw.execute({
        gatewayReference: initiated.gatewayReference!,
        transactionId: initiated.transactionId
      });

      const afterExecute = await gw.verify({
        gatewayReference: initiated.gatewayReference!,
        transactionId: initiated.transactionId,
        expectedAmount: 1200,
        expectedCurrency: 'BDT'
      });
      expect(afterExecute.success).toBe(true);
      expect(afterExecute.status).toBe('success');
    });

    it('MockPaymentGateway never exposes credentials', async () => {
      const gw = new MockPaymentGateway({ provider: 'mock' });
      const initiated = await gw.initiate({ bookingId: 1, amount: 100, currency: 'BDT' });
      const verify = await gw.verify({
        gatewayReference: initiated.gatewayReference!,
        transactionId: initiated.transactionId,
        expectedAmount: 100,
        expectedCurrency: 'BDT'
      });
      const raw = JSON.stringify(verify.raw);
      expect(raw).not.toContain('secret');
      expect(raw).not.toContain('password');
    });
  });
});
