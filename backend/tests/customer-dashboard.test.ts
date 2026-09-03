import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(20000);

import express from 'express';
import http from 'http';
import bookingRoutes from '../src/routes/booking.routes';
import authRoutes from '../src/routes/auth.routes';
import jwt from 'jsonwebtoken';

function signToken(user: { id: number; phone: string; role: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(user, secret, { expiresIn: '1h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
  return app;
}

function request(app: express.Express, method: string, path: string, opts: { token?: string; body?: any } = {}) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as { port: number };
      const url = `http://127.0.0.1:${port}${path}`;
      const data = opts.body ? JSON.stringify(opts.body) : null;
      const req = http.request(url, {
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
          try { body = JSON.parse(text); } catch { /* leave as text */ }
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

async function setupWorld() {
  const vendor = await prisma.user.create({
    data: { phone: '01911000001', passwordHash: 'hash', role: 'vendor', fullName: 'Vendor Owner' }
  });
  const provider = await prisma.serviceProvider.create({
    data: {
      userId: vendor.id,
      businessName: 'Test Operator',
      category: 'bus',
      address: 'Dhaka',
      city: 'Dhaka',
      phone: '01711000001',
      status: 'APPROVED',
      isVerified: true,
      isActive: true
    }
  });
  const customer = await prisma.user.create({
    data: { phone: '01811000001', passwordHash: 'hash', role: 'customer', fullName: 'Cust One' }
  });
  const otherCustomer = await prisma.user.create({
    data: { phone: '01811000002', passwordHash: 'hash', role: 'customer', fullName: 'Cust Two' }
  });
  return { vendor, provider, customer, otherCustomer };
}

async function createBooking(userId: number, providerId: number, category: string, status: string, paymentStatus: string, travelDate: string) {
  return prisma.booking.create({
    data: {
      userId,
      providerId,
      category,
      bookingDate: new Date('2026-09-01'),
      travelDate: new Date(travelDate),
      numberOfPeople: 1,
      totalAmount: 1000,
      discountAmount: 0,
      finalAmount: 1000,
      status,
      paymentStatus
    }
  });
}

describe('Customer Dashboard & Booking Management', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.review.deleteMany();
    await prisma.qrLog.deleteMany();
    await prisma.seatLock.deleteMany();
        await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.serviceAvailability.deleteMany();
    await prisma.service.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.user.deleteMany();
  });

  const app = createApp();

  // =====================================================================
  // BOOKING LIST & AUTHORIZATION
  // =====================================================================
  describe('Booking List & Authorization', () => {
    it('1. Customer can list their own bookings', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');
      await createBooking(customer.id, provider.id, 'flight', 'pending', 'pending', '2026-10-15');

      const res = await request(app, 'GET', '/api/v1/bookings', { token });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('2. Customer cannot see another customer\'s bookings', async () => {
      const { provider, customer, otherCustomer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await createBooking(otherCustomer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');
      await createBooking(otherCustomer.id, provider.id, 'flight', 'pending', 'pending', '2026-10-15');

      const res = await request(app, 'GET', '/api/v1/bookings', { token });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0);
    });

    it('3. Unauthenticated user cannot list bookings', async () => {
      const res = await request(app, 'GET', '/api/v1/bookings');
      expect(res.status).toBe(401);
    });
  });

  // =====================================================================
  // BOOKING FILTERING
  // =====================================================================
  describe('Booking Filtering', () => {
    it('4. Filter bookings by category (bus)', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');
      await createBooking(customer.id, provider.id, 'flight', 'pending', 'pending', '2026-10-15');
      await createBooking(customer.id, provider.id, 'hotel', 'confirmed', 'paid', '2026-11-01');

      const res = await request(app, 'GET', '/api/v1/bookings?category=bus', { token });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].category).toBe('bus');
    });

    it('5. Filter bookings by category (flight)', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');
      await createBooking(customer.id, provider.id, 'flight', 'pending', 'pending', '2026-10-15');
      await createBooking(customer.id, provider.id, 'hotel', 'confirmed', 'paid', '2026-11-01');

      const res = await request(app, 'GET', '/api/v1/bookings?category=flight', { token });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].category).toBe('flight');
    });

    it('6. Filter bookings by category (hotel)', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');
      await createBooking(customer.id, provider.id, 'flight', 'pending', 'pending', '2026-10-15');
      await createBooking(customer.id, provider.id, 'hotel', 'confirmed', 'paid', '2026-11-01');

      const res = await request(app, 'GET', '/api/v1/bookings?category=hotel', { token });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].category).toBe('hotel');
    });

    it('7. Filter bookings by status (cancelled)', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');
      await createBooking(customer.id, provider.id, 'flight', 'cancelled', 'refunded', '2026-10-15');

      const res = await request(app, 'GET', '/api/v1/bookings?status=cancelled', { token });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe('cancelled');
    });

    it('8. Search bookings by booking code', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      const booking1 = await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');
      await createBooking(customer.id, provider.id, 'flight', 'pending', 'pending', '2026-10-15');

      const res = await request(app, 'GET', `/api/v1/bookings?search=${booking1.bookingCode.substring(0, 8)}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(booking1.id);
    });
  });

  // =====================================================================
  // BOOKING DETAILS
  // =====================================================================
  describe('Booking Details', () => {
    it('9. Customer can view their own booking details', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      const booking = await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');

      const res = await request(app, 'GET', `/api/v1/bookings/${booking.id}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(booking.id);
      expect(res.body.category).toBe('bus');
      expect(res.body.provider).toBeDefined();
    });

    it('10. Customer cannot view another customer\'s booking details', async () => {
      const { provider, customer, otherCustomer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      const booking = await createBooking(otherCustomer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');

      const res = await request(app, 'GET', `/api/v1/bookings/${booking.id}`, { token });
      expect(res.status).toBe(403);
    });
  });

  // =====================================================================
  // BOOKING CANCELLATION
  // =====================================================================
  describe('Booking Cancellation', () => {
    it('11. Customer can cancel their own eligible booking', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      const booking = await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');

      const res = await request(app, 'PATCH', `/api/v1/bookings/${booking.id}/cancel`, { token });
      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('cancelled');
    });

    it('12. Customer cannot cancel another customer\'s booking', async () => {
      const { provider, customer, otherCustomer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      const booking = await createBooking(otherCustomer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');

      const res = await request(app, 'PATCH', `/api/v1/bookings/${booking.id}/cancel`, { token });
      expect(res.status).toBe(403);
    });
  });

  // =====================================================================
  // DASHBOARD STATS
  // =====================================================================
  describe('Dashboard Stats', () => {
    it('13. Returns correct stats summary for customer', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');
      await createBooking(customer.id, provider.id, 'flight', 'pending', 'pending', '2026-10-15');
      await createBooking(customer.id, provider.id, 'hotel', 'cancelled', 'refunded', '2026-11-01');

      const res = await request(app, 'GET', '/api/v1/bookings/stats/summary', { token });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.upcoming).toBe(2);
      expect(res.body.cancelled).toBe(1);
      expect(res.body.paid).toBe(1);
      expect(res.body.byCategory.bus).toBe(1);
      expect(res.body.byCategory.flight).toBe(1);
      expect(res.body.byCategory.hotel).toBe(1);
    });

    it('14. Stats only count current user\'s bookings', async () => {
      const { provider, customer, otherCustomer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await createBooking(customer.id, provider.id, 'bus', 'confirmed', 'paid', '2026-10-01');
      await createBooking(otherCustomer.id, provider.id, 'flight', 'pending', 'pending', '2026-10-15');
      await createBooking(otherCustomer.id, provider.id, 'hotel', 'cancelled', 'refunded', '2026-11-01');

      const res = await request(app, 'GET', '/api/v1/bookings/stats/summary', { token });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.byCategory.bus).toBe(1);
      expect(res.body.byCategory.flight).toBe(0);
    });

    it('15. Returns null nextTrip when no upcoming bookings', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await createBooking(customer.id, provider.id, 'bus', 'cancelled', 'refunded', '2026-08-01');

      const res = await request(app, 'GET', '/api/v1/bookings/stats/summary', { token });
      expect(res.status).toBe(200);
      expect(res.body.nextTrip).toBeNull();
    });
  });

  // =====================================================================
  // QR TRAVEL PASS INTEGRATION
  // =====================================================================
  describe('QR Travel Pass Integration', () => {
    it('16. Booking list includes qrCode field for ticket access', async () => {
      const { provider, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });

      await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: provider.id,
          category: 'bus',
          bookingDate: new Date('2026-09-01'),
          travelDate: new Date('2026-10-01'),
          numberOfPeople: 1,
          totalAmount: 1000,
          discountAmount: 0,
          finalAmount: 1000,
          status: 'confirmed',
          paymentStatus: 'paid',
          qrCode: 'data:image/png;base64,test',
          qrToken: 'testtoken123'
        }
      });

      const res = await request(app, 'GET', '/api/v1/bookings', { token });
      expect(res.status).toBe(200);
      expect(res.body[0].qrCode).toBeDefined();
      expect(res.body[0].qrCode).toBe('data:image/png;base64,test');
    });
  });
});
