import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(30000);

import express from 'express';
import http from 'http';
import hotelRoutes from '../src/routes/hotel.routes';
import bookingRoutes from '../src/routes/booking.routes';
import authRoutes from '../src/routes/auth.routes';
import paymentRoutes from '../src/routes/payment.routes';
import qrRoutes from '../src/routes/qr.routes';
import jwt from 'jsonwebtoken';

function signToken(user: { id: number; phone: string; role: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(user, secret, { expiresIn: '1h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/hotels', hotelRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/qr', qrRoutes);
  app.use('/api/v1/travel-passes', qrRoutes);
  return app;
}

function request(app: express.Express, method: string, path: string, opts: { token?: string; body?: any; query?: any } = {}) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as { port: number };
      let url = `http://127.0.0.1:${port}${path}`;
      if (opts.query && Object.keys(opts.query).length > 0) {
        const qs = new URLSearchParams(opts.query as Record<string, string>).toString();
        url += `?${qs}`;
      }
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

async function setupHotelWorld() {
  await prisma.settlement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.hotelAvailability.deleteMany();
  await prisma.room.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.user.deleteMany();

  const customer = await prisma.user.create({
    data: { phone: '01811000001', passwordHash: 'hash', role: 'customer', fullName: 'Cust One' }
  });

  const otherCustomer = await prisma.user.create({
    data: { phone: '01811000002', passwordHash: 'hash', role: 'customer', fullName: 'Cust Two' }
  });

  const vendor = await prisma.user.create({
    data: { phone: '01911000001', passwordHash: 'hash', role: 'vendor', fullName: 'Hotel Owner' }
  });

  const otherVendor = await prisma.user.create({
    data: { phone: '01911000002', passwordHash: 'hash', role: 'vendor', fullName: 'Other Owner' }
  });

  const admin = await prisma.user.create({
    data: { phone: '01711000001', passwordHash: 'hash', role: 'admin', fullName: 'Admin User' }
  });

  const hotel = await prisma.serviceProvider.create({
    data: {
      userId: vendor.id,
      businessName: 'Ocean View Resort',
      category: 'hotel',
      description: 'Luxury beachfront hotel',
      address: 'Cox\'s Bazar',
      city: 'Cox\'s Bazar',
      phone: '01911000001',
      status: 'APPROVED',
      isVerified: true,
      isActive: true,
      rating: 4.5,
      commissionRate: 10.0
    }
  });

  const room = await prisma.room.create({
    data: {
      providerId: hotel.id,
      name: 'Deluxe Sea View',
      type: 'AC',
      description: 'Beautiful sea view room',
      price: 3500,
      capacity: 2,
      totalRooms: 1,
      amenities: 'WiFi, AC, TV',
      isAvailable: true
    }
  });

  return { customer, otherCustomer, vendor, otherVendor, admin, hotel, room };
}

describe('Phase 7 — Complete Hotel Module', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await prisma.settlement.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.review.deleteMany();
    await prisma.qrLog.deleteMany();
    await prisma.seatLock.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.hotelAvailability.deleteMany();
    await prisma.room.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.user.deleteMany();
  });

  const app = createApp();

  // =====================================================================
  // 1. HOTEL LISTING & ROOMS
  // =====================================================================
  describe('1. Hotel listing and rooms', () => {
    it('should list hotels', async () => {
      await setupHotelWorld();
      const res = await request(app, 'GET', '/api/v1/hotels/search');
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });

    it('should list rooms for a hotel', async () => {
      const { hotel } = await setupHotelWorld();
      const res = await request(app, 'GET', `/api/v1/hotels/rooms?hotelId=${hotel.id}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });

    it('should return room availability', async () => {
      const { room } = await setupHotelWorld();
      const res = await request(app, 'GET', `/api/v1/hotels/rooms/${room.id}/availability`);
      expect(res.status).toBe(200);
    });
  });

  // =====================================================================
  // 2. HOTEL BOOKING & AVAILABILITY
  // =====================================================================
  describe('2. Hotel booking and availability', () => {
    it('should create a hotel booking', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const res = await request(app, 'POST', '/api/v1/hotels/book', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.booking.status).toBe('pending');
      expect(res.body.booking.paymentStatus).toBe('pending');
    });

    it('should reject booking unavailable room', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      // First booking takes the room
      await request(app, 'POST', '/api/v1/hotels/book', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });

      // Second booking should fail (same room, overlapping dates)
      const otherToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const res = await request(app, 'POST', '/api/v1/hotels/book', {
        token: otherToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-16',
          checkOutDate: '2026-09-18',
          numberOfGuests: 1,
          totalAmount: 7000,
          customerInfo: { name: 'Jane Smith', email: 'jane@example.com', phone: '01811000002' }
        }
      });
      expect(res.status).toBe(409);
    });

    it('should prevent double booking same room same dates', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res1 = await request(app, 'POST', '/api/v1/hotels/book', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      expect(res1.status).toBe(201);

      const res2 = await request(app, 'POST', '/api/v1/hotels/book', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      expect(res2.status).toBe(409);
    });
  });

  // =====================================================================
  // 3. PREPAID PAYMENT REQUIREMENT
  // =====================================================================
  describe('3. Prepaid payment requirement', () => {
    it('should require payment before check-in', async () => {
      const { hotel, vendor, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      // Create booking
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      expect(bookRes.status).toBe(201);
      const bookingId = bookRes.body.booking.id;

      // Try check-in without payment - should fail
      const checkInRes = await request(app, 'POST', '/api/v1/hotels/check-in', {
        token: vendToken,
        body: { bookingId }
      });
      expect(checkInRes.status).toBe(400);
      expect(checkInRes.body.error).toMatch(/payment not confirmed/i);
    });

    it('should confirm booking after payment verification', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      // Create booking
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Initiate payment
      const payInitRes = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: custToken,
        body: { bookingId, method: 'bkash', amount: 7000 }
      });
      expect(payInitRes.status).toBe(201);
      const transactionId = payInitRes.body.transactionId;

      // Verify payment
      const payVerifyRes = await request(app, 'POST', '/api/v1/payments/verify', {
        token: custToken,
        body: { transactionId }
      });
      expect(payVerifyRes.status).toBe(200);

      // Check booking is now confirmed
      const statusRes = await request(app, 'GET', `/api/v1/hotels/bookings/${bookingId}/status`, { token: custToken });
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.status).toBe('confirmed');
      expect(statusRes.body.paymentStatus).toBe('paid');
    });
  });

  // =====================================================================
  // 4. QR GENERATION & CHECK-IN
  // =====================================================================
  describe('4. QR generation and check-in', () => {
    it('should generate QR after payment confirmation', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      // Create booking
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Pay and confirm
      const payInitRes = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: custToken,
        body: { bookingId, method: 'bkash', amount: 7000 }
      });
      await request(app, 'POST', '/api/v1/payments/verify', {
        token: custToken,
        body: { transactionId: payInitRes.body.transactionId }
      });

      // Generate travel pass
      const passRes = await request(app, 'POST', '/api/v1/travel-passes', {
        token: custToken,
        body: { bookingId }
      });
      expect(passRes.status).toBe(200);
      expect(passRes.body.travelPass.qrObject).toBeDefined();
      expect(passRes.body.travelPass.qrDataUrl).toBeDefined();
    });

    it('should check in with valid QR', async () => {
      const { hotel, vendor, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      // Create booking
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Pay and confirm
      const payInitRes = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: custToken,
        body: { bookingId, method: 'bkash', amount: 7000 }
      });
      await request(app, 'POST', '/api/v1/payments/verify', {
        token: custToken,
        body: { transactionId: payInitRes.body.transactionId }
      });

      // Generate travel pass
      const passRes = await request(app, 'POST', '/api/v1/travel-passes', {
        token: custToken,
        body: { bookingId }
      });
      const qrObject = passRes.body.travelPass.qrObject;

      // Check in with QR
      const checkInRes = await request(app, 'POST', '/api/v1/hotels/check-in', {
        token: vendToken,
        body: { qrData: qrObject }
      });
      expect(checkInRes.status).toBe(200);
      expect(checkInRes.body.booking.status).toBe('confirmed');
    });

    it('should reject invalid QR check-in', async () => {
      const { hotel, vendor, customer, room } = await setupHotelWorld();
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      // Try check-in with invalid QR
      const res = await request(app, 'POST', '/api/v1/hotels/check-in', {
        token: vendToken,
        body: { qrData: { payload: { tp: 'invalid', bkg: 'invalid' }, signature: 'invalid' } }
      });
      expect(res.status).toBe(400);
    });

    it('should reject duplicate QR check-in', async () => {
      const { hotel, vendor, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      // Create booking
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Pay and confirm
      const payInitRes = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: custToken,
        body: { bookingId, method: 'bkash', amount: 7000 }
      });
      await request(app, 'POST', '/api/v1/payments/verify', {
        token: custToken,
        body: { transactionId: payInitRes.body.transactionId }
      });

      // Generate travel pass
      const passRes = await request(app, 'POST', '/api/v1/travel-passes', {
        token: custToken,
        body: { bookingId }
      });
      const qrObject = passRes.body.travelPass.qrObject;

      // First check-in
      const checkIn1 = await request(app, 'POST', '/api/v1/hotels/check-in', {
        token: vendToken,
        body: { qrData: qrObject }
      });
      expect(checkIn1.status).toBe(200);

      // Second check-in with same QR - should fail
      const checkIn2 = await request(app, 'POST', '/api/v1/hotels/check-in', {
        token: vendToken,
        body: { qrData: qrObject }
      });
      expect(checkIn2.status).toBe(400);
      expect(checkIn2.body.error).toMatch(/already checked in/i);
    });

    it('should reject unauthorized hotel staff check-in', async () => {
      const { hotel, vendor, otherVendor, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const otherVendToken = signToken({ id: otherVendor.id, phone: otherVendor.phone, role: 'vendor' });

      // Create booking
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Pay and confirm
      const payInitRes = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: custToken,
        body: { bookingId, method: 'bkash', amount: 7000 }
      });
      await request(app, 'POST', '/api/v1/payments/verify', {
        token: custToken,
        body: { transactionId: payInitRes.body.transactionId }
      });

      // Try check-in with different vendor - should fail
      const checkInRes = await request(app, 'POST', '/api/v1/hotels/check-in', {
        token: otherVendToken,
        body: { bookingId }
      });
      expect(checkInRes.status).toBe(403);
    });
  });

  // =====================================================================
  // 5. CHECK-OUT
  // =====================================================================
  describe('5. Hotel check-out', () => {
    it('should check out a checked-in booking', async () => {
      const { hotel, vendor, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      // Create booking
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Pay and confirm
      const payInitRes = await request(app, 'POST', '/api/v1/payments/initiate', {
        token: custToken,
        body: { bookingId, method: 'bkash', amount: 7000 }
      });
      await request(app, 'POST', '/api/v1/payments/verify', {
        token: custToken,
        body: { transactionId: payInitRes.body.transactionId }
      });

      // Check in
      await request(app, 'POST', '/api/v1/hotels/check-in', {
        token: vendToken,
        body: { bookingId }
      });

      // Check out
      const checkOutRes = await request(app, 'POST', '/api/v1/hotels/check-out', {
        token: vendToken,
        body: { bookingId }
      });
      expect(checkOutRes.status).toBe(200);
      expect(checkOutRes.body.booking.status).toBe('completed');
    });

    it('should reject check-out for booking not checked in', async () => {
      const { hotel, vendor, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      // Create booking
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Try check-out without check-in - should fail
      const checkOutRes = await request(app, 'POST', '/api/v1/hotels/check-out', {
        token: vendToken,
        body: { bookingId }
      });
      expect(checkOutRes.status).toBe(400);
    });
  });

  // =====================================================================
  // 6. CUSTOMER BOOKING ISOLATION
  // =====================================================================
  describe('6. Customer booking isolation', () => {
    it('should prevent customer from accessing another customer\'s booking', async () => {
      const { hotel, customer, otherCustomer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const otherCustToken = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: 'customer' });

      // Create booking as customer 1
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Try to access as customer 2
      const statusRes = await request(app, 'GET', `/api/v1/hotels/bookings/${bookingId}/status`, { token: otherCustToken });
      expect(statusRes.status).toBe(403);
    });

    it('should allow customer to cancel their own booking', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      // Create booking
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Cancel booking
      const cancelRes = await request(app, 'PATCH', `/api/v1/hotels/bookings/${bookingId}/cancel`, { token: custToken });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.booking.status).toBe('cancelled');
    });
  });

  // =====================================================================
  // 7. HOTEL DASHBOARD
  // =====================================================================
  describe('7. Hotel dashboard', () => {
    it('should return hotel dashboard summary', async () => {
      const { hotel, vendor, customer, room } = await setupHotelWorld();
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'GET', '/api/v1/hotels/dashboard/summary', { token: vendToken });
      expect(res.status).toBe(200);
      expect(res.body.hotels).toBeDefined();
      expect(res.body.rooms).toBeDefined();
      expect(res.body.bookings).toBeDefined();
      expect(res.body.revenue).toBeDefined();
    });

    it('should return today\'s check-ins', async () => {
      const { hotel, vendor } = await setupHotelWorld();
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'GET', '/api/v1/hotels/dashboard/check-ins-today', { token: vendToken });
      expect(res.status).toBe(200);
      expect(res.body.checkIns).toBeDefined();
    });

    it('should return today\'s check-outs', async () => {
      const { hotel, vendor } = await setupHotelWorld();
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'GET', '/api/v1/hotels/dashboard/check-outs-today', { token: vendToken });
      expect(res.status).toBe(200);
      expect(res.body.checkOuts).toBeDefined();
    });

    it('should return settlement history', async () => {
      const { hotel, vendor } = await setupHotelWorld();
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'GET', '/api/v1/hotels/dashboard/settlements', { token: vendToken });
      expect(res.status).toBe(200);
      expect(res.body.settlements).toBeDefined();
      expect(res.body.summary).toBeDefined();
    });
  });

  // =====================================================================
  // 8. COMMISSION & SETTLEMENT
  // =====================================================================
  describe('8. Commission and settlement', () => {
    it('should calculate commission correctly (10% of 5000 = 500)', async () => {
      const { hotel, admin } = await setupHotelWorld();
      const adminToken = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });

      // Create a completed booking with payment
      const booking = await prisma.booking.create({
        data: {
          userId: admin.id,
          providerId: hotel.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: new Date('2026-09-15'),
          returnDate: new Date('2026-09-17'),
          numberOfPeople: 2,
          totalAmount: 5000,
          discountAmount: 0,
          finalAmount: 5000,
          status: 'completed',
          paymentStatus: 'paid'
        }
      });

      // Create settlement
      const res = await request(app, 'POST', '/api/v1/hotels/dashboard/settlements', {
        token: adminToken,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(201);
      expect(res.body.settlement.grossAmount).toBe(5000);
      expect(res.body.settlement.commissionRate).toBe(10);
      expect(res.body.settlement.commissionAmount).toBe(500);
      expect(res.body.settlement.netAmount).toBe(4500);
    });

    it('should prevent duplicate settlement for same booking', async () => {
      const { hotel, admin } = await setupHotelWorld();
      const adminToken = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });

      const booking = await prisma.booking.create({
        data: {
          userId: admin.id,
          providerId: hotel.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: new Date('2026-09-15'),
          returnDate: new Date('2026-09-17'),
          numberOfPeople: 2,
          totalAmount: 5000,
          discountAmount: 0,
          finalAmount: 5000,
          status: 'completed',
          paymentStatus: 'paid'
        }
      });

      // First settlement
      await request(app, 'POST', '/api/v1/hotels/dashboard/settlements', {
        token: adminToken,
        body: { bookingId: booking.id }
      });

      // Second settlement - should fail
      const res = await request(app, 'POST', '/api/v1/hotels/dashboard/settlements', {
        token: adminToken,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(409);
    });

    it('should mark settlement as paid', async () => {
      const { hotel, admin, vendor } = await setupHotelWorld();
      const adminToken = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });

      const booking = await prisma.booking.create({
        data: {
          userId: admin.id,
          providerId: hotel.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: new Date('2026-09-15'),
          returnDate: new Date('2026-09-17'),
          numberOfPeople: 2,
          totalAmount: 5000,
          discountAmount: 0,
          finalAmount: 5000,
          status: 'completed',
          paymentStatus: 'paid'
        }
      });

      // Create settlement
      const createRes = await request(app, 'POST', '/api/v1/hotels/dashboard/settlements', {
        token: adminToken,
        body: { bookingId: booking.id }
      });
      const settlementId = createRes.body.settlement.id;

      // Mark as paid
      const markRes = await request(app, 'PATCH', `/api/v1/hotels/dashboard/settlements/${settlementId}/mark-paid`, {
        token: adminToken
      });
      expect(markRes.status).toBe(200);
      expect(markRes.body.settlement.status).toBe('paid');
      expect(markRes.body.settlement.settledAt).toBeDefined();
    });
  });

  // =====================================================================
  // 9. CANCELLATION RULES
  // =====================================================================
  describe('9. Cancellation rules', () => {
    it('should release room inventory on cancellation', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      // Create booking for 2 nights
      const bookRes = await request(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      // Check availability before cancellation
      const availBefore = await prisma.hotelAvailability.findMany({
        where: { roomId: room.id }
      });
      const bookedBefore = availBefore.reduce((sum, a) => sum + a.bookedRooms, 0);
      expect(bookedBefore).toBeGreaterThan(0);

      // Cancel booking
      await request(app, 'PATCH', `/api/v1/hotels/bookings/${bookingId}/cancel`, { token: custToken });

      // Check availability after cancellation (should release all nights)
      const availAfter = await prisma.hotelAvailability.findMany({
        where: { roomId: room.id }
      });
      const bookedAfter = availAfter.reduce((sum, a) => sum + a.bookedRooms, 0);
      // Booking was for 2 nights (Sep 15, Sep 16), so 2 rooms should be released
      expect(bookedAfter).toBeLessThan(bookedBefore);
    });

    it('should not allow cancellation of completed booking', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      // Create booking directly as completed
      const booking = await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: hotel.id,
          roomId: room.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: new Date('2026-09-15'),
          returnDate: new Date('2026-09-17'),
          numberOfPeople: 2,
          totalAmount: 7000,
          discountAmount: 0,
          finalAmount: 7000,
          status: 'completed',
          paymentStatus: 'paid'
        }
      });

      // Try to cancel completed booking
      const cancelRes = await request(app, 'PATCH', `/api/v1/hotels/bookings/${booking.id}/cancel`, { token: custToken });
      expect(cancelRes.status).toBe(400);
    });
  });
});
