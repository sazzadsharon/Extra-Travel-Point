import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(30000);

import express from 'express';
import http from 'http';
import busRoutes from '../src/routes/bus.routes';
import busRouteRoutes from '../src/routes/bus-route.routes';
import busTripRoutes from '../src/routes/bus-trip.routes';
import busTripPublicRoutes from '../src/routes/bus-trip-public.routes';

console.log('busRoutes type:', typeof busRoutes, 'stack:', busRoutes.stack ? busRoutes.stack.length + ' layers' : 'no stack');
console.log('busRouteRoutes type:', typeof busRouteRoutes);
console.log('busTripRoutes type:', typeof busTripRoutes);
import transportRoutes from '../src/routes/transport.routes';
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
  app.use('/api/v1/transport/trips', busTripPublicRoutes);
  app.use('/api/v1/vendors/me/buses', busRoutes);
  app.use('/api/v1/vendors/me/bus-routes', busRouteRoutes);
  app.use('/api/v1/vendors/me/bus-trips', busTripRoutes);
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
  const otherVendor = await prisma.user.create({
    data: { phone: '01911000002', passwordHash: 'hash', role: 'vendor', fullName: 'Other Vendor' }
  });
  const otherProvider = await prisma.serviceProvider.create({
    data: {
      userId: otherVendor.id,
      businessName: 'Hanif Enterprise',
      category: 'bus',
      description: 'Bus operator',
      address: 'Sayedabad, Dhaka',
      city: 'Dhaka',
      phone: '01711000002',
      status: 'APPROVED',
      isVerified: true,
      isActive: true
    }
  });
  const customer = await prisma.user.create({
    data: { phone: '01811000001', passwordHash: 'hash', role: 'customer', fullName: 'Cust One' }
  });
  const admin = await prisma.user.create({
    data: { phone: '01710000001', passwordHash: 'hash', role: 'admin', fullName: 'Admin User' }
  });

  return { vendor, provider, otherVendor, otherProvider, customer, admin };
}

describe('Bus Step 2 — Authorization & Validation', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
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
  });

  const app = createApp();
  app.use('/api/v1/buses-test', busRoutes);

  // Simple inline route to test mounting
  app.get('/api/v1/vendors/me/test', (req, res) => res.json({ ok: true }));

  it('debug: inline route works', async () => {
    const res = await request(app, 'GET', '/api/v1/vendors/me/test');
    console.log('DEBUG inline:', res.status, JSON.stringify(res.body));
    expect(res.status).toBe(200);
  });

  it('debug: bus routes via different mount', async () => {
    const vendor = await prisma.user.create({
      data: { phone: '01911000003', passwordHash: 'hash', role: 'vendor', fullName: 'Test Vendor' }
    });
    const provider = await prisma.serviceProvider.create({
      data: {
        userId: vendor.id,
        businessName: 'Test Bus Co',
        category: 'bus',
        address: 'Test',
        status: 'APPROVED',
        isActive: true
      }
    });
    const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
    const res = await request(app, 'POST', '/api/v1/buses-test', {
      token,
      body: {
        registrationNumber: 'DHK-003',
        busName: 'Test Bus',
        busType: 'AC',
        totalSeats: 40
      }
    });
    console.log('DEBUG buses-test:', res.status, JSON.stringify(res.body).slice(0, 200));
    expect(res.status).toBe(201);
  });

  it('debug: bus routes direct mount with token', async () => {
    const vendor = await prisma.user.create({
      data: { phone: '01911000004', passwordHash: 'hash', role: 'vendor', fullName: 'Test Vendor 2' }
    });
    const provider = await prisma.serviceProvider.create({
      data: {
        userId: vendor.id,
        businessName: 'Test Bus Co 2',
        category: 'bus',
        address: 'Test',
        status: 'APPROVED',
        isActive: true
      }
    });
    const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
    
    // First test ping
    const pingRes = await request(app, 'GET', '/api/v1/vendors/me/buses/ping');
    console.log('DEBUG ping:', pingRes.status, JSON.stringify(pingRes.body));
    
    const pingPostRes = await request(app, 'POST', '/api/v1/vendors/me/buses/ping-post');
    console.log('DEBUG ping-post:', pingPostRes.status, JSON.stringify(pingPostRes.body));
    
    const res = await request(app, 'POST', '/api/v1/vendors/me/buses', {
      token,
      body: {
        registrationNumber: 'DHK-004',
        busName: 'Test Bus 2',
        busType: 'AC',
        totalSeats: 40
      }
    });
    console.log('DEBUG direct mount:', res.status, JSON.stringify(res.body).slice(0, 200));
  });

  it('debug: transport buses works', async () => {
    const res = await request(app, 'GET', '/api/v1/transport/buses');
    console.log('DEBUG transport buses:', res.status);
  });

  it('debug: vendors me buses works', async () => {
    const res = await request(app, 'GET', '/api/v1/vendors/me/buses');
    console.log('DEBUG vendors me buses:', res.status, JSON.stringify(res.body).slice(0, 200));
  });

  // Debug: log registered routes
  console.log('ROUTES:', app._router.stack.filter((r: any) => r.route).map((r: any) => r.route?.path || r.name).join(', '));

  // ==========================================================================
  // BUS AUTHORIZATION
  // ==========================================================================

  describe('Bus Authorization', () => {
    it('vendor can create own Bus', async () => {
      const { vendor, provider } = await setupBusWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/buses', {
        token,
        body: {
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC Coach',
          busType: 'AC',
          totalSeats: 40
        }
      });
      console.log('DEBUG create bus:', JSON.stringify(res));
      expect(res.status).toBe(201);
      expect(res.body.bus.registrationNumber).toBe('DHK-001');
      expect(res.body.bus.providerId).toBe(provider.id);
    });

    it('customer cannot create Bus', async () => {
      const { customer } = await setupBusWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/buses', {
        token,
        body: {
          registrationNumber: 'DHK-002',
          busName: 'Customer Bus',
          busType: 'AC',
          totalSeats: 40
        }
      });
      expect(res.status).toBe(403);
    });

    it('vendor cannot modify another vendor Bus', async () => {
      const { vendor, otherVendor, otherProvider } = await setupBusWorld();
      const otherBus = await prisma.bus.create({
        data: {
          providerId: otherProvider.id,
          registrationNumber: 'DHK-OTHER',
          busName: 'Other Bus',
          busType: 'NON_AC',
          totalSeats: 30
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'PATCH', `/api/v1/vendors/me/buses/${otherBus.id}`, {
        token,
        body: { busName: 'Hacked Bus' }
      });
      expect(res.status).toBe(404);
    });

    it('vendor cannot delete another vendor Bus', async () => {
      const { vendor, otherVendor, otherProvider } = await setupBusWorld();
      const otherBus = await prisma.bus.create({
        data: {
          providerId: otherProvider.id,
          registrationNumber: 'DHK-OTHER',
          busName: 'Other Bus',
          busType: 'NON_AC',
          totalSeats: 30
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'DELETE', `/api/v1/vendors/me/buses/${otherBus.id}`, { token });
      expect(res.status).toBe(404);

      const stillExists = await prisma.bus.findUnique({ where: { id: otherBus.id } });
      expect(stillExists).not.toBeNull();
    });

    it('vendor can list own Buses', async () => {
      const { vendor, provider } = await setupBusWorld();
      await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Bus One',
          busType: 'AC',
          totalSeats: 40
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'GET', '/api/v1/vendors/me/buses', { token });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.buses[0].registrationNumber).toBe('DHK-001');
    });

    it('duplicate registration number is rejected', async () => {
      const { vendor, provider } = await setupBusWorld();
      await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Bus One',
          busType: 'AC',
          totalSeats: 40
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/buses', {
        token,
        body: {
          registrationNumber: 'DHK-001',
          busName: 'Duplicate Bus',
          busType: 'NON_AC',
          totalSeats: 30
        }
      });
      expect(res.status).toBe(409);
    });
  });

  // ==========================================================================
  // ROUTE AUTHORIZATION
  // ==========================================================================

  describe('Route Authorization', () => {
    it('vendor can create own Route', async () => {
      const { vendor, provider } = await setupBusWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-routes', {
        token,
        body: {
          origin: 'Dhaka',
          destination: 'Chattogram',
          distanceKm: 250
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.route.origin).toBe('Dhaka');
      expect(res.body.route.destination).toBe('Chattogram');
      expect(res.body.route.providerId).toBe(provider.id);
    });

    it('customer cannot create Route', async () => {
      const { customer } = await setupBusWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-routes', {
        token,
        body: {
          origin: 'Dhaka',
          destination: 'Sylhet'
        }
      });
      expect(res.status).toBe(403);
    });

    it('vendor cannot modify another vendor Route', async () => {
      const { vendor, otherProvider } = await setupBusWorld();
      const otherRoute = await prisma.busRoute.create({
        data: {
          providerId: otherProvider.id,
          origin: 'Cox\'s Bazar',
          destination: 'Chittagong'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'PATCH', `/api/v1/vendors/me/bus-routes/${otherRoute.id}`, {
        token,
        body: { origin: 'Hacked Origin' }
      });
      expect(res.status).toBe(404);
    });

    it('vendor cannot delete another vendor Route', async () => {
      const { vendor, otherProvider } = await setupBusWorld();
      const otherRoute = await prisma.busRoute.create({
        data: {
          providerId: otherProvider.id,
          origin: 'Cox\'s Bazar',
          destination: 'Chittagong'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'DELETE', `/api/v1/vendors/me/bus-routes/${otherRoute.id}`, { token });
      expect(res.status).toBe(404);

      const stillExists = await prisma.busRoute.findUnique({ where: { id: otherRoute.id } });
      expect(stillExists).not.toBeNull();
    });

    it('same origin and destination is rejected', async () => {
      const { vendor } = await setupBusWorld();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-routes', {
        token,
        body: {
          origin: 'Dhaka',
          destination: 'Dhaka'
        }
      });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // TRIP AUTHORIZATION
  // ==========================================================================

  describe('Trip Authorization', () => {
    it('vendor can create Trip for own Bus and Route', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: bus.id,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.trip.busId).toBe(bus.id);
      expect(res.body.trip.routeId).toBe(route.id);
    });

    it('vendor cannot create Trip using another vendor Bus', async () => {
      const { vendor, otherProvider } = await setupBusWorld();
      const otherBus = await prisma.bus.create({
        data: {
          providerId: otherProvider.id,
          registrationNumber: 'DHK-OTHER',
          busName: 'Other Bus',
          busType: 'NON_AC',
          totalSeats: 30
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: otherProvider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: otherBus.id,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid bus for this operator/);
    });

    it('vendor cannot create Trip using another vendor Route', async () => {
      const { vendor, otherProvider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: otherProvider.id,
          registrationNumber: 'DHK-OTHER',
          busName: 'Other Bus',
          busType: 'NON_AC',
          totalSeats: 30
        }
      });
      const otherRoute = await prisma.busRoute.create({
        data: {
          providerId: otherProvider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: bus.id,
          routeId: otherRoute.id,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid bus for this operator/);
    });

    it('customer cannot create Trip', async () => {
      const { customer } = await setupBusWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: customer.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: 1,
          routeId: 1,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(403);
    });

    it('vendor cannot modify another vendor Trip', async () => {
      const { vendor, otherVendor, otherProvider } = await setupBusWorld();
      const otherBus = await prisma.bus.create({
        data: {
          providerId: otherProvider.id,
          registrationNumber: 'DHK-OTHER',
          busName: 'Other Bus',
          busType: 'NON_AC',
          totalSeats: 30
        }
      });
      const otherRoute = await prisma.busRoute.create({
        data: {
          providerId: otherProvider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });
      const otherTrip = await prisma.busTrip.create({
        data: {
          busId: otherBus.id,
          routeId: otherRoute.id,
          providerId: otherProvider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '08:00',
          arrivalTime: '14:00',
          departureTimestamp: new Date('2026-09-15T08:00:00'),
          arrivalTimestamp: new Date('2026-09-15T14:00:00'),
          status: 'SCHEDULED',
          availableSeats: 30
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'PATCH', `/api/v1/vendors/me/bus-trips/${otherTrip.id}`, {
        token,
        body: { status: 'OPEN' }
      });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // TRIP VALIDATION
  // ==========================================================================

  describe('Trip Validation', () => {
    it('valid Trip creation', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: bus.id,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.trip.departureTime).toBe('08:00');
      expect(res.body.trip.arrivalTime).toBe('14:00');
      expect(res.body.trip.status).toBe('SCHEDULED');
    });

    it('invalid Bus is rejected', async () => {
      const { vendor, provider } = await setupBusWorld();
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: 999999,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(400);
    });

    it('invalid Route is rejected', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: bus.id,
          routeId: 999999,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(400);
    });

    it('mismatched Bus/Operator is rejected', async () => {
      const { vendor, otherProvider } = await setupBusWorld();
      const otherBus = await prisma.bus.create({
        data: {
          providerId: otherProvider.id,
          registrationNumber: 'DHK-OTHER',
          busName: 'Other Bus',
          busType: 'NON_AC',
          totalSeats: 30
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: otherProvider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: otherBus.id,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid bus for this operator/);
    });

    it('duplicate schedule is rejected', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });
      await prisma.busTrip.create({
        data: {
          busId: bus.id,
          routeId: route.id,
          providerId: provider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '08:00',
          arrivalTime: '14:00',
          departureTimestamp: new Date('2026-09-15T08:00:00'),
          arrivalTimestamp: new Date('2026-09-15T14:00:00'),
          status: 'SCHEDULED',
          availableSeats: 40
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: bus.id,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Duplicate trip/);
    });

    it('invalid departure time is rejected', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: bus.id,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '25:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(400);
    });

    it('arrival time before departure is rejected', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: bus.id,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '14:00',
          arrivalTime: '08:00'
        }
      });
      expect(res.status).toBe(400);
    });

    it('inactive Bus cannot have Trips created', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40,
          isActive: false,
          status: 'INACTIVE'
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: bus.id,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Bus is not active/);
    });

    it('inactive Route cannot have Trips created', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram',
          isActive: false
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'POST', '/api/v1/vendors/me/bus-trips', {
        token,
        body: {
          busId: bus.id,
          routeId: route.id,
          departureDate: '2026-09-15',
          departureTime: '08:00',
          arrivalTime: '14:00'
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Route is not active/);
    });

    it('departed Trip cannot be deleted', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });
      const trip = await prisma.busTrip.create({
        data: {
          busId: bus.id,
          routeId: route.id,
          providerId: provider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '08:00',
          arrivalTime: '14:00',
          departureTimestamp: new Date('2026-09-15T08:00:00'),
          arrivalTimestamp: new Date('2026-09-15T14:00:00'),
          status: 'DEPARTED',
          availableSeats: 40
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'DELETE', `/api/v1/vendors/me/bus-trips/${trip.id}`, { token });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot delete trip with status: DEPARTED/);
    });

    it('cancelled Trip cannot be deleted', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });
      const trip = await prisma.busTrip.create({
        data: {
          busId: bus.id,
          routeId: route.id,
          providerId: provider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '08:00',
          arrivalTime: '14:00',
          departureTimestamp: new Date('2026-09-15T08:00:00'),
          arrivalTimestamp: new Date('2026-09-15T14:00:00'),
          status: 'CANCELLED',
          availableSeats: 40
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const res = await request(app, 'DELETE', `/api/v1/vendors/me/bus-trips/${trip.id}`, { token });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot delete trip with status: CANCELLED/);
    });

    it('unauthorized access returns 404', async () => {
      const { vendor, otherVendor, otherProvider } = await setupBusWorld();
      const otherBus = await prisma.bus.create({
        data: {
          providerId: otherProvider.id,
          registrationNumber: 'DHK-OTHER',
          busName: 'Other Bus',
          busType: 'NON_AC',
          totalSeats: 30
        }
      });
      const otherRoute = await prisma.busRoute.create({
        data: {
          providerId: otherProvider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });
      const otherTrip = await prisma.busTrip.create({
        data: {
          busId: otherBus.id,
          routeId: otherRoute.id,
          providerId: otherProvider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '08:00',
          arrivalTime: '14:00',
          departureTimestamp: new Date('2026-09-15T08:00:00'),
          arrivalTimestamp: new Date('2026-09-15T14:00:00'),
          status: 'SCHEDULED',
          availableSeats: 30
        }
      });

      const token = signToken({ id: vendor.id, phone: vendor.phone, role: vendor.role });
      const getRes = await request(app, 'GET', `/api/v1/vendors/me/bus-trips/${otherTrip.id}`, { token });
      expect(getRes.status).toBe(404);
    });
  });

  // ==========================================================================
  // PUBLIC TRIP SEARCH
  // ==========================================================================

  describe('Public Trip Search', () => {
    it('returns scheduled trips for a date and route', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });
      await prisma.busTrip.create({
        data: {
          busId: bus.id,
          routeId: route.id,
          providerId: provider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '08:00',
          arrivalTime: '14:00',
          departureTimestamp: new Date('2026-09-15T08:00:00'),
          arrivalTimestamp: new Date('2026-09-15T14:00:00'),
          status: 'SCHEDULED',
          availableSeats: 40,
          pricePerSeat: 1200
        }
      });

      const res = await request(app, 'GET', '/api/v1/transport/trips?origin=Dhaka&destination=Chattogram&date=2026-09-15');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.trips[0].bus.busType).toBe('AC');
      expect(res.body.trips[0].pricePerSeat).toBe(1200);
    });

    it('filters by bus type', async () => {
      const { vendor, provider } = await setupBusWorld();
      const busAc = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-AC',
          busName: 'AC Bus',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const busNonAc = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-NONAC',
          busName: 'Non-AC Bus',
          busType: 'NON_AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });
      await prisma.busTrip.create({
        data: {
          busId: busAc.id,
          routeId: route.id,
          providerId: provider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '08:00',
          arrivalTime: '14:00',
          departureTimestamp: new Date('2026-09-15T08:00:00'),
          arrivalTimestamp: new Date('2026-09-15T14:00:00'),
          status: 'OPEN',
          availableSeats: 40
        }
      });
      await prisma.busTrip.create({
        data: {
          busId: busNonAc.id,
          routeId: route.id,
          providerId: provider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '10:00',
          arrivalTime: '16:00',
          departureTimestamp: new Date('2026-09-15T10:00:00'),
          arrivalTimestamp: new Date('2026-09-15T16:00:00'),
          status: 'OPEN',
          availableSeats: 40
        }
      });

      const res = await request(app, 'GET', '/api/v1/transport/trips?origin=Dhaka&destination=Chattogram&date=2026-09-15&busType=AC');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.trips[0].bus.busType).toBe('AC');
    });

    it('does not return cancelled or departed trips', async () => {
      const { vendor, provider } = await setupBusWorld();
      const bus = await prisma.bus.create({
        data: {
          providerId: provider.id,
          registrationNumber: 'DHK-001',
          busName: 'Green Line AC',
          busType: 'AC',
          totalSeats: 40
        }
      });
      const route = await prisma.busRoute.create({
        data: {
          providerId: provider.id,
          origin: 'Dhaka',
          destination: 'Chattogram'
        }
      });
      await prisma.busTrip.create({
        data: {
          busId: bus.id,
          routeId: route.id,
          providerId: provider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '08:00',
          arrivalTime: '14:00',
          departureTimestamp: new Date('2026-09-15T08:00:00'),
          arrivalTimestamp: new Date('2026-09-15T14:00:00'),
          status: 'CANCELLED',
          availableSeats: 40
        }
      });
      await prisma.busTrip.create({
        data: {
          busId: bus.id,
          routeId: route.id,
          providerId: provider.id,
          departureDate: new Date('2026-09-15'),
          departureTime: '10:00',
          arrivalTime: '16:00',
          departureTimestamp: new Date('2026-09-15T10:00:00'),
          arrivalTimestamp: new Date('2026-09-15T16:00:00'),
          status: 'DEPARTED',
          availableSeats: 40
        }
      });

      const res = await request(app, 'GET', '/api/v1/transport/trips?origin=Dhaka&destination=Chattogram&date=2026-09-15');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  // ==========================================================================
  // BACKWARD COMPATIBILITY
  // ==========================================================================

  describe('Backward Compatibility', () => {
    it('existing transport/buses endpoint still works', async () => {
      const { vendor, provider } = await setupBusWorld();
      await prisma.service.create({
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

      const res = await request(app, 'GET', '/api/v1/transport/buses');
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });
  });
});
