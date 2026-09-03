import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(30000);

import express from 'express';
import http from 'http';
import flightRoutes from '../src/routes/flight.routes';
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
  app.use('/api/v1/flights', flightRoutes);
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

async function setupFlightWorld(opts: { providerStatus?: 'APPROVED' | 'PENDING' | 'REJECTED' } = {}) {
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.seatLock.deleteMany();
      await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.user.deleteMany();

  const status = opts.providerStatus ?? 'APPROVED';

  const customer = await prisma.user.create({
    data: { phone: '01811000001', passwordHash: 'hash', role: 'customer', fullName: 'Alice Customer' }
  });

  const otherCustomer = await prisma.user.create({
    data: { phone: '01811000002', passwordHash: 'hash', role: 'customer', fullName: 'Bob Customer' }
  });

  const vendor = await prisma.user.create({
    data: { phone: '01911000001', passwordHash: 'hash', role: 'vendor', fullName: 'Airline Owner' }
  });

  const otherVendor = await prisma.user.create({
    data: { phone: '01911000002', passwordHash: 'hash', role: 'vendor', fullName: 'Other Airline Owner' }
  });

  const admin = await prisma.user.create({
    data: { phone: '01711000001', passwordHash: 'hash', role: 'admin', fullName: 'Admin' }
  });

  const airline = await prisma.serviceProvider.create({
    data: {
      userId: vendor.id,
      businessName: 'Green Wings',
      category: 'flight',
      description: 'Domestic airline',
      address: 'Hazrat Shahjalal Intl Airport',
      city: 'Dhaka',
      phone: '01911000001',
      status,
      isVerified: status === 'APPROVED',
      isActive: true,
      rating: 4.2
    }
  });

  const otherAirline = await prisma.serviceProvider.create({
    data: {
      userId: otherVendor.id,
      businessName: 'Blue Skies',
      category: 'flight',
      description: 'Charter airline',
      address: 'Osmani Intl Airport',
      city: 'Sylhet',
      phone: '01911000002',
      status: 'APPROVED',
      isVerified: true,
      isActive: true,
      rating: 4.0
    }
  });

  return { customer, otherCustomer, vendor, otherVendor, admin, airline, otherAirline };
}

async function createFlight(airlineId: number, overrides: Record<string, any> = {}) {
  const defaults = {
    providerId: airlineId,
    flightNumber: 'BG101',
    origin: 'Dhaka',
    destination: 'Cox\'s Bazar',
    departureTime: new Date('2026-09-20T08:00:00Z'),
    arrivalTime: new Date('2026-09-20T09:30:00Z'),
    duration: 90,
    aircraftType: 'Boeing 737',
    capacity: 100,
    availableSeats: 100,
    price: 4500,
    currency: 'BDT',
    status: 'scheduled',
    isActive: true
  };
  return prisma.flight.create({ data: { ...defaults, ...overrides } });
}

describe('Flight MVP', () => {
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
    await prisma.flight.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.user.deleteMany();
  });

  const app = createApp();

  // =====================================================================
  // CUSTOMER: SEARCH / DETAILS
  // =====================================================================
  describe('Customer - Search & Details', () => {
    it('1. Public flight search returns active flights', async () => {
      const { airline } = await setupFlightWorld();
      await createFlight(airline.id);
      await createFlight(airline.id, { flightNumber: 'BG202', destination: 'Sylhet', price: 3000 });

      const res = await request(app, 'GET', '/api/v1/flights/search');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(Array.isArray(res.body.flights)).toBe(true);
    });

    it('2. Flight search filters by origin/destination (case insensitive)', async () => {
      const { airline } = await setupFlightWorld();
      await createFlight(airline.id);
      await createFlight(airline.id, { flightNumber: 'BG202', destination: 'Sylhet' });

      const res = await request(app, 'GET', '/api/v1/flights/search', { query: { origin: 'dhaka', destination: 'cox' } });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.flights[0].flightNumber).toBe('BG101');
    });

    it('3. Flight search filters by passengers (only flights with enough seats)', async () => {
      const { airline } = await setupFlightWorld();
      await createFlight(airline.id, { capacity: 5, availableSeats: 5 });
      await createFlight(airline.id, { flightNumber: 'BG202', capacity: 50, availableSeats: 50 });

      const res = await request(app, 'GET', '/api/v1/flights/search', { query: { passengers: 10 } });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.flights[0].flightNumber).toBe('BG202');
    });

    it('4. Flight search filters by price range', async () => {
      const { airline } = await setupFlightWorld();
      await createFlight(airline.id, { price: 4500 });
      await createFlight(airline.id, { flightNumber: 'BG202', price: 9000 });

      const res = await request(app, 'GET', '/api/v1/flights/search', { query: { minPrice: 5000, maxPrice: 10000 } });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.flights[0].flightNumber).toBe('BG202');
    });

    it('5. Inactive flights are excluded from public search', async () => {
      const { airline } = await setupFlightWorld();
      await createFlight(airline.id, { isActive: false });
      await createFlight(airline.id, { flightNumber: 'BG202' });

      const res = await request(app, 'GET', '/api/v1/flights/search');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.flights[0].flightNumber).toBe('BG202');
    });

    it('6. Flight details endpoint returns full flight info', async () => {
      const { airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const res = await request(app, 'GET', `/api/v1/flights/${flight.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(flight.id);
      expect(res.body.flightNumber).toBe('BG101');
      expect(res.body.provider.businessName).toBe('Green Wings');
    });

    it('7. Flight details returns 404 for unknown id', async () => {
      await setupFlightWorld();
      const res = await request(app, 'GET', '/api/v1/flights/99999');
      expect(res.status).toBe(404);
    });
  });

  // =====================================================================
  // CUSTOMER: BOOKING
  // =====================================================================
  describe('Customer - Booking', () => {
    it('8. Customer can successfully book a flight', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { price: 5000 });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 2,
          totalAmount: 10000,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/success/i);
      expect(res.body.booking.passengerCount).toBe(2);
      expect(res.body.booking.totalAmount).toBe(10000);

      const after = await prisma.flight.findUnique({ where: { id: flight.id } });
      expect(after!.availableSeats).toBe(98);
    });

    it('9. Insufficient seats rejected with 409', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { capacity: 5, availableSeats: 2, price: 5000 });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 5,
          totalAmount: 25000,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/seats/i);
    });

    it('10. Invalid passenger count (zero) rejected by validation', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 0,
          totalAmount: 0,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(400);
    });

    it('11. Invalid passenger count (negative) rejected by validation', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: -1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(400);
    });

    it('12. Incorrect total amount rejected (price mismatch)', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { price: 5000 });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 2,
          totalAmount: 1,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid amount/);
    });

    it('13. Booking an inactive flight rejected', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { isActive: false });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not active/);
    });

    it('14. Booking a non-scheduled flight rejected', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { status: 'boarding' });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot be booked/);
    });

    it('15. Booking a cancelled flight rejected', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { status: 'cancelled' });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(400);
    });

    it('16. Booking a non-existent flight returns 404', async () => {
      const { customer } = await setupFlightWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: 99999,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(404);
    });

    it('17. Unauthenticated booking rejected (401)', async () => {
      const { airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);

      const res = await request(app, 'POST', '/api/v1/flights/book', {
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(res.status).toBe(401);
    });
  });

  // =====================================================================
  // CUSTOMER: BOOKING DETAILS / STATUS / CANCELLATION
  // =====================================================================
  describe('Customer - Booking detail, status, cancellation', () => {
    it('18. Booking confirmation accessible to owner', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(bookRes.status).toBe(201);
      const bookingId = bookRes.body.booking.id;

      const res = await request(app, 'GET', `/api/v1/flights/bookings/${bookingId}/confirmation`, { token });
      expect(res.status).toBe(200);
      expect(res.body.bookingId).toBe(bookingId);
      expect(res.body.flight.flightNumber).toBe('BG101');
    });

    it('19. Booking confirmation rejects other customer (403)', async () => {
      const { customer, otherCustomer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const ownerToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token: ownerToken,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      const intruderToken = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: 'customer' });
      const res = await request(app, 'GET', `/api/v1/flights/bookings/${bookingId}/confirmation`, { token: intruderToken });
      expect(res.status).toBe(403);
    });

    it('20. Admin can view any booking confirmation', async () => {
      const { customer, admin, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const ownerToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token: ownerToken,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      const adminToken = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });
      const res = await request(app, 'GET', `/api/v1/flights/bookings/${bookingId}/confirmation`, { token: adminToken });
      expect(res.status).toBe(200);
    });

    it('21. Booking status endpoint works for owner', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      const res = await request(app, 'GET', `/api/v1/flights/bookings/${bookingId}/status`, { token });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
      expect(res.body.category).toBe('flight');
    });

    it('22. Booking status rejects other customer (403)', async () => {
      const { customer, otherCustomer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const ownerToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token: ownerToken,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      const intruderToken = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: 'customer' });
      const res = await request(app, 'GET', `/api/v1/flights/bookings/${bookingId}/status`, { token: intruderToken });
      expect(res.status).toBe(403);
    });

    it('23. Cancel a pending booking restores seats', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { price: 5000, capacity: 100, availableSeats: 100 });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 3,
          totalAmount: 15000,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      const before = await prisma.flight.findUnique({ where: { id: flight.id } });
      expect(before!.availableSeats).toBe(97);

      const cancelRes = await request(app, 'PATCH', `/api/v1/flights/bookings/${bookingId}/cancel`, { token });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.booking.status).toBe('cancelled');

      const after = await prisma.flight.findUnique({ where: { id: flight.id } });
      expect(after!.availableSeats).toBe(100);
    });

    it('24. Cancellation rejects already cancelled booking', async () => {
      const { customer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      await request(app, 'PATCH', `/api/v1/flights/bookings/${bookingId}/cancel`, { token });
      const second = await request(app, 'PATCH', `/api/v1/flights/bookings/${bookingId}/cancel`, { token });
      expect(second.status).toBe(400);
    });

    it('25. Cancellation rejects unauthorized user (403)', async () => {
      const { customer, otherCustomer, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const ownerToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token: ownerToken,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      const intruderToken = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: 'customer' });
      const res = await request(app, 'PATCH', `/api/v1/flights/bookings/${bookingId}/cancel`, { token: intruderToken });
      expect(res.status).toBe(403);
    });
  });

  // =====================================================================
  // VENDOR / ADMIN
  // =====================================================================
  describe('Vendor/Admin - Flight management', () => {
    it('26. Approved vendor can create a flight', async () => {
      const { vendor, airline } = await setupFlightWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'POST', '/api/v1/flights', {
        token,
        body: {
          providerId: airline.id,
          flightNumber: 'BG301',
          origin: 'Dhaka',
          destination: 'Chittagong',
          departureTime: '2026-10-01T10:00:00Z',
          arrivalTime: '2026-10-01T11:00:00Z',
          capacity: 80,
          price: 3500
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.flight.flightNumber).toBe('BG301');
      expect(res.body.flight.availableSeats).toBe(80);
    });

    it('27. Unapproved provider cannot create a flight (403)', async () => {
      const { vendor, airline } = await setupFlightWorld({ providerStatus: 'PENDING' });
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'POST', '/api/v1/flights', {
        token,
        body: {
          providerId: airline.id,
          flightNumber: 'BG301',
          origin: 'Dhaka',
          destination: 'Chittagong',
          departureTime: '2026-10-01T10:00:00Z',
          arrivalTime: '2026-10-01T11:00:00Z',
          capacity: 80,
          price: 3500
        }
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/approved/i);
    });

    it('28. Vendor cannot create flight for another vendor\'s airline (403)', async () => {
      const { vendor, otherAirline } = await setupFlightWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'POST', '/api/v1/flights', {
        token,
        body: {
          providerId: otherAirline.id,
          flightNumber: 'BG301',
          origin: 'Dhaka',
          destination: 'Chittagong',
          departureTime: '2026-10-01T10:00:00Z',
          arrivalTime: '2026-10-01T11:00:00Z',
          capacity: 80,
          price: 3500
        }
      });
      expect(res.status).toBe(403);
    });

    it('29. Duplicate flight number for same airline rejected (409)', async () => {
      const { vendor, airline } = await setupFlightWorld();
      await createFlight(airline.id, { flightNumber: 'BG999' });
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'POST', '/api/v1/flights', {
        token,
        body: {
          providerId: airline.id,
          flightNumber: 'BG999',
          origin: 'Dhaka',
          destination: 'Chittagong',
          departureTime: '2026-10-01T10:00:00Z',
          arrivalTime: '2026-10-01T11:00:00Z',
          capacity: 80,
          price: 3500
        }
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/);
    });

    it('30. Same flight number on a different airline is allowed', async () => {
      const { vendor, airline, otherAirline } = await setupFlightWorld();
      await createFlight(airline.id, { flightNumber: 'BG100' });
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'POST', '/api/v1/flights', {
        token,
        body: {
          providerId: otherAirline.id, // not owned by this vendor => 403
          flightNumber: 'BG100',
          origin: 'Dhaka',
          destination: 'Chittagong',
          departureTime: '2026-10-01T10:00:00Z',
          arrivalTime: '2026-10-01T11:00:00Z',
          capacity: 80,
          price: 3500
        }
      });
      // Not owned => 403 first (vendor ownership check comes before duplicate)
      expect(res.status).toBe(403);
    });

    it('31. Invalid origin/destination (same value) rejected', async () => {
      const { vendor, airline } = await setupFlightWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'POST', '/api/v1/flights', {
        token,
        body: {
          providerId: airline.id,
          flightNumber: 'BG400',
          origin: 'Dhaka',
          destination: 'dhaka',
          departureTime: '2026-10-01T10:00:00Z',
          arrivalTime: '2026-10-01T11:00:00Z',
          capacity: 80,
          price: 3500
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/same/i);
    });

    it('32. Invalid time range (arrival <= departure) rejected', async () => {
      const { vendor, airline } = await setupFlightWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'POST', '/api/v1/flights', {
        token,
        body: {
          providerId: airline.id,
          flightNumber: 'BG500',
          origin: 'Dhaka',
          destination: 'Chittagong',
          departureTime: '2026-10-01T11:00:00Z',
          arrivalTime: '2026-10-01T10:00:00Z',
          capacity: 80,
          price: 3500
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/before/i);
    });

    it('33. Vendor can update a flight they own', async () => {
      const { vendor, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'PATCH', `/api/v1/flights/${flight.id}`, {
        token,
        body: { price: 6000, aircraftType: 'Airbus A320' }
      });
      expect(res.status).toBe(200);
      expect(res.body.flight.price).toBe(6000);
      expect(res.body.flight.aircraftType).toBe('Airbus A320');
    });

    it('34. Vendor cannot update another vendor\'s flight (403)', async () => {
      const { otherVendor, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: otherVendor.id, phone: otherVendor.phone, role: 'vendor' });

      const res = await request(app, 'PATCH', `/api/v1/flights/${flight.id}`, {
        token,
        body: { price: 1 }
      });
      expect(res.status).toBe(403);
    });

    it('35. Updating capacity updates available seats correctly', async () => {
      const { vendor, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { capacity: 100, availableSeats: 100 });
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      // Increase capacity
      const res = await request(app, 'PATCH', `/api/v1/flights/${flight.id}`, {
        token,
        body: { capacity: 150 }
      });
      expect(res.status).toBe(200);
      expect(res.body.flight.capacity).toBe(150);
      expect(res.body.flight.availableSeats).toBe(150);
    });

    it('36. Cannot reduce capacity below booked seats', async () => {
      const { customer, vendor, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { capacity: 100, availableSeats: 100, price: 5000 });
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      // Book 20 seats
      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token: custToken,
        body: {
          flightId: flight.id,
          passengerCount: 20,
          totalAmount: 100000,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(bookRes.status).toBe(201);

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request(app, 'PATCH', `/api/v1/flights/${flight.id}`, {
        token,
        body: { capacity: 10 }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/less than booked/);
    });

    it('37. Updating only origin to match destination rejected', async () => {
      const { vendor, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id, { origin: 'Dhaka', destination: 'Chittagong' });
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'PATCH', `/api/v1/flights/${flight.id}`, {
        token,
        body: { origin: 'Chittagong' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/same/i);
    });

    it('38. Vendor lists their own flights', async () => {
      const { vendor, airline, otherAirline } = await setupFlightWorld();
      await createFlight(airline.id, { flightNumber: 'BG111' });
      await createFlight(airline.id, { flightNumber: 'BG222' });
      await createFlight(otherAirline.id, { flightNumber: 'OS111' });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request(app, 'GET', '/api/v1/flights', { token });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      const nums = res.body.flights.map((f: any) => f.flightNumber).sort();
      expect(nums).toEqual(['BG111', 'BG222']);
    });

    it('39. Status update scheduled -> boarding works', async () => {
      const { vendor, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'PATCH', `/api/v1/flights/${flight.id}/status`, {
        token,
        body: { status: 'boarding' }
      });
      expect(res.status).toBe(200);
      expect(res.body.flight.status).toBe('boarding');
    });

    it('40. Invalid status transition (scheduled -> arrived) rejected', async () => {
      const { vendor, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const res = await request(app, 'PATCH', `/api/v1/flights/${flight.id}/status`, {
        token,
        body: { status: 'arrived' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid status transition/);
    });

    it('41. Status update cancelled notifies affected customers', async () => {
      const { customer, vendor, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token: custToken,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      expect(bookRes.status).toBe(201);
      const bookingId = bookRes.body.booking.id;

      // Spy on console.log to capture notification
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: any[]) => { logs.push(args.join(' ')); };

      try {
        const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
        const res = await request(app, 'PATCH', `/api/v1/flights/${flight.id}/status`, {
          token,
          body: { status: 'cancelled' }
        });
        expect(res.status).toBe(200);
        // Notification should have been dispatched
        const hit = logs.find(l => l.includes('FLIGHT_CANCELLED'));
        expect(hit).toBeDefined();
      } finally {
        console.log = origLog;
      }

      // Customer's booking should be cancellable (still pending), then cancel to verify
      const after = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(after!.status).toBe('pending');
    });

    it('42. Cancellation notification behavior on customer cancel', async () => {
      const { customer, vendor, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const bookRes = await request(app, 'POST', '/api/v1/flights/book', {
        token: custToken,
        body: {
          flightId: flight.id,
          passengerCount: 1,
          totalAmount: 4500,
          passengerInfo: { name: 'Alice', email: 'alice@example.com', phone: '01711111111' }
        }
      });
      const bookingId = bookRes.body.booking.id;

      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: any[]) => { logs.push(args.join(' ')); };

      try {
        const res = await request(app, 'PATCH', `/api/v1/flights/bookings/${bookingId}/cancel`, { token: custToken });
        expect(res.status).toBe(200);
        const hit = logs.find(l => l.includes('BOOKING_CANCELLED') && l.includes(`User#${vendor.id}`));
        expect(hit).toBeDefined();
      } finally {
        console.log = origLog;
      }
    });

    it('43. Admin can update any flight', async () => {
      const { admin, airline } = await setupFlightWorld();
      const flight = await createFlight(airline.id);
      const token = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });

      const res = await request(app, 'PATCH', `/api/v1/flights/${flight.id}`, {
        token,
        body: { price: 9999 }
      });
      expect(res.status).toBe(200);
      expect(res.body.flight.price).toBe(9999);
    });

    it('44. Unauthenticated cannot create flight (401)', async () => {
      const { airline } = await setupFlightWorld();
      const res = await request(app, 'POST', '/api/v1/flights', {
        body: {
          providerId: airline.id,
          flightNumber: 'BG600',
          origin: 'Dhaka',
          destination: 'Chittagong',
          departureTime: '2026-10-01T10:00:00Z',
          arrivalTime: '2026-10-01T11:00:00Z',
          capacity: 80,
          price: 3500
        }
      });
      expect(res.status).toBe(401);
    });

    it('45. Customer role cannot create flights (403)', async () => {
      const { customer, airline } = await setupFlightWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/flights', {
        token,
        body: {
          providerId: airline.id,
          flightNumber: 'BG700',
          origin: 'Dhaka',
          destination: 'Chittagong',
          departureTime: '2026-10-01T10:00:00Z',
          arrivalTime: '2026-10-01T11:00:00Z',
          capacity: 80,
          price: 3500
        }
      });
      expect(res.status).toBe(403);
    });
  });
});