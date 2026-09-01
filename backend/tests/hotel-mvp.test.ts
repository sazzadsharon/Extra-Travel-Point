import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(30000);

import express from 'express';
import http from 'http';
import hotelRoutes from '../src/routes/hotel.routes';
import bookingRoutes from '../src/routes/booking.routes';
import authRoutes from '../src/routes/auth.routes';
import providerRoutes from '../src/routes/provider.routes';
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
  app.use('/api/v1/providers', providerRoutes);
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
  await prisma.booking.deleteMany();
  await prisma.hotelAvailability.deleteMany();
  await prisma.room.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.user.deleteMany();

  const customer = await prisma.user.create({
    data: { phone: '01811000001', passwordHash: 'hash', role: 'customer', fullName: 'Cust One' }
  });

  const vendor = await prisma.user.create({
    data: { phone: '01911000001', passwordHash: 'hash', role: 'vendor', fullName: 'Hotel Owner' }
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
      rating: 4.5
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
      amenities: 'WiFi, AC, TV',
      isAvailable: true
    }
  });

  return { customer, vendor, hotel, room };
}

describe('Hotel MVP', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await prisma.booking.deleteMany();
    await prisma.hotelAvailability.deleteMany();
    await prisma.room.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.user.deleteMany();
  });

  const app = createApp();

  // === HOTEL LISTING/SEARCH ===
  describe('1. Hotel listing/search', () => {
    it('should return hotels matching the search criteria', async () => {
      await setupHotelWorld();
      const res = await request(app, 'GET', '/api/v1/hotels/search?city=Cox\'s+Bazar');
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body.hotels[0].businessName).toBe('Ocean View Resort');
    });

    it('should filter hotels by rating', async () => {
      await setupHotelWorld();
      const res = await request(app, 'GET', '/api/v1/hotels/search', { query: { rating: 4 } });
      expect(res.status).toBe(200);
      expect(res.body.hotels.every((h: any) => (h.rating || 0) >= 4)).toBe(true);
    });

    it('should return empty results for non-matching city', async () => {
      await setupHotelWorld();
      const res = await request(app, 'GET', '/api/v1/hotels/search?city=Dhaka');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  // === HOTEL DETAILS ===
  describe('2. Hotel details', () => {
    it('should return hotel details with rooms', async () => {
      const { hotel, room } = await setupHotelWorld();
      const res = await request(app, 'GET', `/api/v1/hotels/details/${hotel.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(hotel.id);
      expect(res.body.businessName).toBe('Ocean View Resort');
      expect(res.body.rooms.length).toBeGreaterThanOrEqual(1);
      expect(res.body.rooms[0].name).toBe('Deluxe Sea View');
    });

    it('should return 404 for non-existent hotel', async () => {
      const res = await request(app, 'GET', '/api/v1/hotels/details/99999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Hotel not found');
    });
  });

  // === ROOM TYPE MANAGEMENT ===
  describe('3. Room type management', () => {
    it('should create a room for a hotel (vendor)', async () => {
      const { hotel, vendor } = await setupHotelWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request(app, 'POST', '/api/v1/hotels/rooms', {
        token,
        body: {
          hotelId: hotel.id,
          name: 'Super Deluxe Suite',
          type: 'AC',
          description: 'Spacious suite',
          price: 6500,
          capacity: 4,
          amenities: 'WiFi, AC, TV, Mini Bar'
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.room.name).toBe('Super Deluxe Suite');
      expect(res.body.room.price).toBe(6500);
    });

    it('should return 403 if vendor tries to create room for another vendor\'s hotel', async () => {
      const { hotel, vendor } = await setupHotelWorld();
      const otherVendor = await prisma.user.create({
        data: { phone: '01911000002', passwordHash: 'hash', role: 'vendor', fullName: 'Other Owner' }
      });
      const token = signToken({ id: otherVendor.id, phone: otherVendor.phone, role: 'vendor' });
      const res = await request(app, 'POST', '/api/v1/hotels/rooms', {
        token,
        body: {
          hotelId: hotel.id,
          name: 'Intruder Room',
          type: 'AC',
          price: 5000
        }
      });
      expect(res.status).toBe(403);
    });

    it('should list rooms for a hotel', async () => {
      const { hotel } = await setupHotelWorld();
      const res = await request(app, 'GET', `/api/v1/hotels/rooms?hotelId=${hotel.id}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });
  });

  // === ROOM AVAILABILITY ===
  describe('4. Room availability', () => {
    it('should create availability for a room (vendor)', async () => {
      const { hotel, vendor, room } = await setupHotelWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request(app, 'POST', `/api/v1/hotels/rooms/${room.id}/availability`, {
        token,
        body: {
          roomId: room.id,
          date: '2026-09-15',
          totalRooms: 5
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.availability.totalRooms).toBe(5);
    });

    it('should return availability for a room', async () => {
      const { hotel, vendor, room } = await setupHotelWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      await request(app, 'POST', `/api/v1/hotels/rooms/${room.id}/availability`, {
        token,
        body: { roomId: room.id, date: '2026-09-15', totalRooms: 5 }
      });
      const res = await request(app, 'GET', `/api/v1/hotels/rooms/${room.id}/availability`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });
  });

  // === CHECK-IN / CHECK-OUT ===
  describe('5. Check-in / Check-out', () => {
    it('should check in a hotel booking (vendor)', async () => {
      const { hotel, vendor, customer, room } = await setupHotelWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      // Create a booking first
      const bookingRes = await request(app, 'POST', '/api/v1/bookings', {
        token: signToken({ id: customer.id, phone: customer.phone, role: 'customer' }),
        body: {
          providerId: hotel.id,
          category: 'hotel',
          bookingDate: '2026-09-10',
          travelDate: '2026-09-15',
          numberOfPeople: 2,
          totalAmount: 3500,
          discountAmount: 0,
          finalAmount: 3500,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });
      expect(bookingRes.status).toBe(201);
      const bookingId = bookingRes.body.booking.id;

      // Check-in
      const res = await request(app, 'POST', '/api/v1/hotels/check-in', {
        token,
        body: { bookingId }
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Check-in successful/);
    });

    it('should check out a hotel booking (vendor)', async () => {
      const { hotel, vendor, customer } = await setupHotelWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const bookingRes = await request(app, 'POST', '/api/v1/bookings', {
        token: signToken({ id: customer.id, phone: customer.phone, role: 'customer' }),
        body: {
          providerId: hotel.id,
          category: 'hotel',
          bookingDate: '2026-09-10',
          travelDate: '2026-09-15',
          numberOfPeople: 2,
          totalAmount: 3500,
          discountAmount: 0,
          finalAmount: 3500,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });
      const bookingId = bookingRes.body.booking.id;

      const res = await request(app, 'POST', '/api/v1/hotels/check-out', {
        token,
        body: { bookingId }
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Check-out successful/);
    });
  });

  // === HOTEL BOOKING ===
  describe('6. Hotel/room booking', () => {
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
          customerInfo: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '01811000001'
          }
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.booking.id).toBeGreaterThan(0);
      expect(res.body.booking.category).toBe('hotel');
      expect(res.body.booking.status).toBe('pending');
    });

    it('should reject booking for non-existent hotel', async () => {
      const { customer } = await setupHotelWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const res = await request(app, 'POST', '/api/v1/hotels/book', {
        token,
        body: {
          hotelId: 99999,
          roomId: 1,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-17',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      expect(res.status).toBe(404);
    });

    it('should reject booking with invalid dates (check-out before check-in)', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const res = await request(app, 'POST', '/api/v1/hotels/book', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-17',
          checkOutDate: '2026-09-15',
          numberOfGuests: 2,
          totalAmount: 7000,
          customerInfo: { name: 'John Doe', email: 'john@example.com', phone: '01811000001' }
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/check-out/i);
    });
  });

  // === BOOKING CONFIRMATION ===
  describe('7. Booking confirmation', () => {
    it('should return booking confirmation', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const createRes = await request(app, 'POST', '/api/v1/bookings', {
        token,
        body: {
          providerId: hotel.id,
          category: 'hotel',
          bookingDate: '2026-09-10',
          travelDate: '2026-09-15',
          numberOfPeople: 2,
          totalAmount: 7000,
          discountAmount: 0,
          finalAmount: 7000,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });
      const bookingId = createRes.body.booking.id;

      const res = await request(app, 'GET', `/api/v1/hotels/bookings/${bookingId}/confirmation`, { token });
      expect(res.status).toBe(200);
      expect(res.body.bookingId).toBe(bookingId);
      expect(res.body.hotel.businessName).toBe('Ocean View Resort');
      expect(res.body.checkInDate).toBeDefined();
    });
  });

  // === BOOKING STATUS ===
  describe('8. Booking status', () => {
    it('should return booking status', async () => {
      const { hotel, customer, room } = await setupHotelWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      // Use the dedicated hotel booking endpoint which respects the hotel flow
      const createRes = await request(app, 'POST', '/api/v1/hotels/book', {
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
      expect(createRes.status).toBe(201);
      const bookingId = createRes.body.booking.id;

      const res = await request(app, 'GET', `/api/v1/hotels/bookings/${bookingId}/status`, { token });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
      expect(res.body.bookingCode).toBeDefined();
    });
  });

  // === BOOKING CANCELLATION ===
  describe('9. Basic cancellation handling', () => {
    it('should cancel a pending hotel booking', async () => {
      const { hotel, customer } = await setupHotelWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const createRes = await request(app, 'POST', '/api/v1/bookings', {
        token,
        body: {
          providerId: hotel.id,
          category: 'hotel',
          bookingDate: '2026-09-10',
          travelDate: '2026-09-15',
          numberOfPeople: 2,
          totalAmount: 7000,
          discountAmount: 0,
          finalAmount: 7000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });
      const bookingId = createRes.body.booking.id;

      const res = await request(app, 'PATCH', `/api/v1/hotels/bookings/${bookingId}/cancel`, { token });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/cancelled/i);
      expect(res.body.booking.status).toBe('cancelled');
    });

    it('should reject cancellation of already cancelled booking', async () => {
      const { hotel, customer } = await setupHotelWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const createRes = await request(app, 'POST', '/api/v1/bookings', {
        token,
        body: {
          providerId: hotel.id,
          category: 'hotel',
          bookingDate: '2026-09-10',
          travelDate: '2026-09-15',
          numberOfPeople: 2,
          totalAmount: 7000,
          discountAmount: 0,
          finalAmount: 7000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });
      const bookingId = createRes.body.booking.id;

      // Cancel first
      await request(app, 'PATCH', `/api/v1/hotels/bookings/${bookingId}/cancel`, { token });

      // Try to cancel again
      const res = await request(app, 'PATCH', `/api/v1/hotels/bookings/${bookingId}/cancel`, { token });
      expect(res.status).toBe(400);
    });
  });

  // === PROVIDER/VENDOR HOTEL MANAGEMENT ===
  describe('10. Provider/vendor hotel management', () => {
    it('should create a hotel provider (vendor)', async () => {
      const { vendor } = await setupHotelWorld();
      // Create a different vendor without a hotel
      const newVendor = await prisma.user.create({
        data: { phone: '01911000099', passwordHash: 'hash', role: 'vendor', fullName: 'New Hotel Owner' }
      });
      const token = signToken({ id: newVendor.id, phone: newVendor.phone, role: 'vendor' });
      const res = await request(app, 'POST', '/api/v1/hotels', {
        token,
        body: {
          businessName: 'Beach Front Hotel',
          address: 'Cox\'s Bazar Beach Road',
          city: 'Cox\'s Bazar',
          phone: '01911000003',
          description: 'Frontline beach hotel'
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.provider.businessName).toBe('Beach Front Hotel');
      expect(res.body.provider.category).toBe('hotel');
    });

    it('should prevent duplicate hotel provider for same user', async () => {
      const { vendor } = await setupHotelWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      await request(app, 'POST', '/api/v1/hotels', {
        token,
        body: {
          businessName: 'Another Hotel',
          address: 'Cox\'s Bazar',
          city: 'Cox\'s Bazar'
        }
      });
      const res = await request(app, 'POST', '/api/v1/hotels', {
        token,
        body: {
          businessName: 'Duplicate Hotel',
          address: 'Cox\'s Bazar',
          city: 'Cox\'s Bazar'
        }
      });
      expect(res.status).toBe(409);
    });

    it('should update a hotel provider (vendor)', async () => {
      const { hotel, vendor } = await setupHotelWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request(app, 'PATCH', `/api/v1/hotels/${hotel.id}`, {
        token,
        body: {
          businessName: 'Updated Ocean View Resort'
        }
      });
      expect(res.status).toBe(200);
      expect(res.body.provider.businessName).toBe('Updated Ocean View Resort');
    });

    it('should verify a hotel (admin)', async () => {
      const { hotel, vendor } = await setupHotelWorld();
      const admin = await prisma.user.create({
        data: { phone: '01712345678', passwordHash: 'hash', role: 'admin', fullName: 'Admin' }
      });
      const token = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });
      const res = await request(app, 'PATCH', `/api/v1/hotels/${hotel.id}/verify`, { token });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/verified/i);
    });
  });
});
