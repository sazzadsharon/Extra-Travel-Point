import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(20000);

// Build a small HTTP harness that exercises the Express router stack used by
// the real backend, but bypasses listening on a port. We mount the bus router
// from src/routes/transport.routes.ts onto a fresh Express app and talk to it
// with `supertest` style requests using the in-process server.
import express from 'express';
import http from 'http';
import transportRoutes from '../src/routes/transport.routes';
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
  app.use('/api/v1/transport', transportRoutes);
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

async function setupBusWorld() {
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.qrLog.deleteMany();
      await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.serviceAvailability.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.user.deleteMany();

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

describe('Bus MVP', () => {
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
        await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.seatLock.deleteMany();
    await prisma.serviceAvailability.deleteMany();
    await prisma.service.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.user.deleteMany();
  });

  const app = createApp();

  it('1. Bus listing works (returns DB-backed buses)', async () => {
    await setupBusWorld();
    const res = await request(app, 'GET', '/api/v1/transport/buses');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.buses[0].route).toContain('Cox');
    expect(res.body.buses[0].price).toBe(1200);
  });

  it('2. Bus details work (returns complete bus information)', async () => {
    const { bus, provider } = await setupBusWorld();
    const res = await request(app, 'GET', `/api/v1/transport/buses/${bus.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(bus.id);
    expect(res.body.route).toBe('Dhaka -> Cox\'s Bazar');
    expect(res.body.price).toBe(1200);
    expect(res.body.currency).toBe('BDT');
    expect(res.body.capacity).toBe(40);
    expect(res.body.provider.businessName).toBe('Green Line');
    expect(res.body.availability.length).toBeGreaterThan(0);
    expect(res.body.availability[0].startTime).toBe('08:00');
    expect(res.body.availability[0].endTime).toBe('14:00');
  });

  it('3. Available seats are returned correctly', async () => {
    const { bus } = await setupBusWorld();
    const res = await request(app, 'GET', `/api/v1/transport/buses/${bus.id}/seats?date=2026-09-15`);
    expect(res.status).toBe(200);
    expect(res.body.busId).toBe(bus.id);
    expect(res.body.totalSeats).toBe(40);
    expect(res.body.seats.length).toBe(40);
    expect(res.body.pricePerSeat).toBe(1200);
    const avail = res.body.seats.filter((s: any) => s.isAvailable).length;
    expect(res.body.availableSeats).toBe(avail);
  });

  it('4. User can select available seats and lock them', async () => {
    const { bus, customer } = await setupBusWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
    const seatsRes = await request(app, 'GET', `/api/v1/transport/buses/${bus.id}/seats?date=2026-09-15`);
    const seats = (seatsRes.body.seats as Array<{ seatNumber: string; isAvailable: boolean }>)
      .filter(s => s.isAvailable)
      .slice(0, 2)
      .map(s => s.seatNumber);

    const lockRes = await request(app, 'POST', '/api/v1/bookings/seats/lock', {
      token,
      body: { seatNumbers: seats, providerId: bus.providerId, category: 'bus', travelDate: '2026-09-15' }
    });
    expect(lockRes.status).toBe(200);
    expect(lockRes.body.lockedSeats.sort()).toEqual(seats.slice().sort());
  });

  it('5. Already booked seats cannot be booked again', async () => {
    const { bus, customer, otherCustomer } = await setupBusWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
    const otherToken = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: otherCustomer.role });

    const seatsRes = await request(app, 'GET', `/api/v1/transport/buses/${bus.id}/seats?date=2026-09-15`);
    const freeSeats = (seatsRes.body.seats as Array<{ seatNumber: string; isAvailable: boolean }>)
      .filter(s => s.isAvailable)
      .slice(0, 1)
      .map(s => s.seatNumber);

    const first = await request(app, 'POST', '/api/v1/bookings', {
      token,
      body: {
        providerId: bus.providerId,
        serviceId: bus.id,
        category: 'bus',
        bookingDate: '2026-09-10',
        travelDate: '2026-09-15',
        numberOfPeople: 1,
        seatNumbers: freeSeats,
        passengers: [{ name: 'P One', email: 'p1@example.com', phone: '01711111111', seatNumber: freeSeats[0] }],
        route: 'Dhaka -> Cox\'s Bazar'
      }
    });
    expect(first.status).toBe(201);

    const second = await request(app, 'POST', '/api/v1/bookings', {
      token: otherToken,
      body: {
        providerId: bus.providerId,
        serviceId: bus.id,
        category: 'bus',
        bookingDate: '2026-09-10',
        travelDate: '2026-09-15',
        numberOfPeople: 1,
        seatNumbers: freeSeats,
        passengers: [{ name: 'P Two', email: 'p2@example.com', phone: '01711111112', seatNumber: freeSeats[0] }],
        route: 'Dhaka -> Cox\'s Bazar'
      }
    });
    expect(second.status).toBe(409);
    expect(JSON.stringify(second.body)).toMatch(/already booked/);
  });

  it('6. User cannot book without authentication', async () => {
    const { bus } = await setupBusWorld();
    const res = await request(app, 'POST', '/api/v1/bookings', {
      body: {
        providerId: bus.providerId,
        serviceId: bus.id,
        category: 'bus',
        bookingDate: '2026-09-10',
        travelDate: '2026-09-15',
        numberOfPeople: 1,
        seatNumbers: ['A1'],
        passengers: [{ name: 'P One', email: 'p1@example.com', phone: '01711111111', seatNumber: 'A1' }]
      }
    });
    expect(res.status).toBe(401);
  });

  it('7. Invalid bus/service is rejected', async () => {
    const { customer } = await setupBusWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
    const res = await request(app, 'POST', '/api/v1/bookings', {
      token,
      body: {
        providerId: 999999,
        serviceId: 999999,
        category: 'bus',
        bookingDate: '2026-09-10',
        travelDate: '2026-09-15',
        numberOfPeople: 1,
        seatNumbers: ['A1'],
        passengers: [{ name: 'P One', email: 'p1@example.com', phone: '01711111111', seatNumber: 'A1' }]
      }
    });
    expect(res.status).toBe(400);
  });

  it('8. Invalid seat is rejected', async () => {
    const { bus, customer } = await setupBusWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
    const res = await request(app, 'POST', '/api/v1/bookings', {
      token,
      body: {
        providerId: bus.providerId,
        serviceId: bus.id,
        category: 'bus',
        bookingDate: '2026-09-10',
        travelDate: '2026-09-15',
        numberOfPeople: 1,
        seatNumbers: ['Z99'],
        passengers: [{ name: 'P One', email: 'p1@example.com', phone: '01711111111', seatNumber: 'Z99' }]
      }
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/Invalid seat/);
  });

  it('9. Duplicate/conflicting seat booking is rejected in the same request', async () => {
    const { bus, customer } = await setupBusWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
    const res = await request(app, 'POST', '/api/v1/bookings', {
      token,
      body: {
        providerId: bus.providerId,
        serviceId: bus.id,
        category: 'bus',
        bookingDate: '2026-09-10',
        travelDate: '2026-09-15',
        numberOfPeople: 2,
        seatNumbers: ['A1', 'A1'],
        passengers: [
          { name: 'P One', email: 'p1@example.com', phone: '01711111111', seatNumber: 'A1' },
          { name: 'P Two', email: 'p2@example.com', phone: '01711111112', seatNumber: 'A1' }
        ]
      }
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/Duplicate/);
  });

  it('10. Server-side price validation works (frontend totalAmount is ignored)', async () => {
    const { bus, customer } = await setupBusWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
    const seatsRes = await request(app, 'GET', `/api/v1/transport/buses/${bus.id}/seats?date=2026-09-15`);
    const freeSeats = (seatsRes.body.seats as Array<{ seatNumber: string; isAvailable: boolean }>)
      .filter(s => s.isAvailable)
      .slice(0, 2)
      .map(s => s.seatNumber);

    const res = await request(app, 'POST', '/api/v1/bookings', {
      token,
      body: {
        providerId: bus.providerId,
        serviceId: bus.id,
        category: 'bus',
        bookingDate: '2026-09-10',
        travelDate: '2026-09-15',
        numberOfPeople: 2,
        seatNumbers: freeSeats,
        passengers: freeSeats.map((sn, i) => ({
          name: `P ${i + 1}`,
          email: `p${i + 1}@example.com`,
          phone: `0171111111${i}`,
          seatNumber: sn
        })),
        // Frontend lies about the price:
        totalAmount: 1
      }
    });
    expect(res.status).toBe(201);
    // Server should charge 1200 per seat regardless of frontend totalAmount.
    expect(res.body.booking.totalAmount).toBe(1200 * freeSeats.length);
  });

  it('11. Successful bus booking works end-to-end', async () => {
    const { bus, customer } = await setupBusWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
    const seatsRes = await request(app, 'GET', `/api/v1/transport/buses/${bus.id}/seats?date=2026-09-15`);
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
        passengers: [{ name: 'P One', email: 'p1@example.com', phone: '01711111111', seatNumber: freeSeats[0] }],
        route: 'Dhaka -> Cox\'s Bazar'
      }
    });
    expect(res.status).toBe(201);
    expect(res.body.booking.id).toBeGreaterThan(0);
    expect(res.body.booking.userId).toBe(customer.id);
    expect(res.body.booking.category).toBe('bus');
    expect(res.body.booking.seatNumbers).toBe(freeSeats[0]);
    expect(res.body.booking.status).toBe('pending');
  });

  it('12. User can retrieve their own booking', async () => {
    const { bus, customer } = await setupBusWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
    const seatsRes = await request(app, 'GET', `/api/v1/transport/buses/${bus.id}/seats?date=2026-09-15`);
    const freeSeats = (seatsRes.body.seats as Array<{ seatNumber: string; isAvailable: boolean }>)
      .filter(s => s.isAvailable)
      .slice(0, 1)
      .map(s => s.seatNumber);

    const create = await request(app, 'POST', '/api/v1/bookings', {
      token,
      body: {
        providerId: bus.providerId,
        serviceId: bus.id,
        category: 'bus',
        bookingDate: '2026-09-10',
        travelDate: '2026-09-15',
        numberOfPeople: 1,
        seatNumbers: freeSeats,
        passengers: [{ name: 'P One', email: 'p1@example.com', phone: '01711111111', seatNumber: freeSeats[0] }]
      }
    });
    const bookingId = create.body.booking.id;

    const get = await request(app, 'GET', `/api/v1/bookings/${bookingId}`, { token });
    expect(get.status).toBe(200);
    expect(get.body.id).toBe(bookingId);
    expect(get.body.userId).toBe(customer.id);
  });

  it('13. User cannot retrieve another user\'s booking', async () => {
    const { bus, customer, otherCustomer } = await setupBusWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
    const otherToken = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: otherCustomer.role });

    const seatsRes = await request(app, 'GET', `/api/v1/transport/buses/${bus.id}/seats?date=2026-09-15`);
    const freeSeats = (seatsRes.body.seats as Array<{ seatNumber: string; isAvailable: boolean }>)
      .filter(s => s.isAvailable)
      .slice(0, 1)
      .map(s => s.seatNumber);

    const create = await request(app, 'POST', '/api/v1/bookings', {
      token,
      body: {
        providerId: bus.providerId,
        serviceId: bus.id,
        category: 'bus',
        bookingDate: '2026-09-10',
        travelDate: '2026-09-15',
        numberOfPeople: 1,
        seatNumbers: freeSeats,
        passengers: [{ name: 'P One', email: 'p1@example.com', phone: '01711111111', seatNumber: freeSeats[0] }]
      }
    });
    const bookingId = create.body.booking.id;

    const stolen = await request(app, 'GET', `/api/v1/bookings/${bookingId}`, { token: otherToken });
    expect(stolen.status).toBe(403);
  });
});
