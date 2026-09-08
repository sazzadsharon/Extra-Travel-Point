import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';

import hotelRoutes from '../src/routes/hotel.routes';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';
import hotelRoomRoutes from '../src/routes/hotel-room.routes';
import hotelBookingRoutes from '../src/routes/hotel-booking.routes';

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
  return app;
}

function request_(app: express.Express, method: string, path: string, opts: { token?: string; body?: any; query?: any } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
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
          try { body = JSON.parse(text); } catch { /* leave */ }
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
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.settlement.deleteMany();
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
  await prisma.room.deleteMany();
  await prisma.service.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
}

describe('STEP 4 — Room, Rate Plan & Inventory Foundation', () => {
  jest.setTimeout(30000);
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await cleanup(); });

  // =====================================================================
  // ROOM MANAGEMENT — Provider CRUD
  // =====================================================================
  describe('Provider room CRUD', () => {
    it('provider can create room under owned hotel', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000001', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'POST', '/api/v1/hotel-rooms', {
        token,
        body: {
          hotelId: hotel.id,
          name: 'Deluxe',
          type: 'DOUBLE',
          price: 5000,
          capacity: 4,
          adultCapacity: 2,
          childCapacity: 2,
          totalRooms: 5,
          roomNumber: 'D-101',
          bedConfig: '1 King',
          size: '25 sqm'
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.room.name).toBe('Deluxe');
      expect(res.body.room.type).toBe('DOUBLE');
      expect(res.body.room.totalRooms).toBe(5);
      expect(res.body.room.size).toBe('25 sqm');
      expect(res.body.room.status).toBe('ACTIVE');
    });

    it('provider cannot create room for another hotel (IDOR)', async () => {
      const owner = await prisma.user.create({ data: { phone: '01940000002', passwordHash: 'h', role: 'vendor' } });
      const intruder = await prisma.user.create({ data: { phone: '01940000003', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: owner.id, businessName: 'Owner H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const app = createApp();
      const token = signToken({ id: intruder.id, phone: intruder.phone, role: 'vendor' });
      const res = await request_(app, 'POST', '/api/v1/hotel-rooms', {
        token,
        body: { hotelId: hotel.id, name: 'Hacked', type: 'X', price: 1000, totalRooms: 1 }
      });
      expect(res.status).toBe(403);
    });

    it('provider can update own room', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000004', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'Old', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'PATCH', `/api/v1/hotel-rooms/${room.id}`, {
        token,
        body: { name: 'New', price: 2000, size: '30 sqm' }
      });
      expect(res.status).toBe(200);
      expect(res.body.room.name).toBe('New');
      expect(res.body.room.price).toBe(2000);
      expect(res.body.room.size).toBe('30 sqm');
    });

    it('provider can deactivate own room', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000005', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'DELETE', `/api/v1/hotel-rooms/${room.id}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.room.status).toBe('INACTIVE');
      expect(res.body.room.isAvailable).toBe(false);
    });

    it('provider cannot modify another provider room', async () => {
      const owner = await prisma.user.create({ data: { phone: '01940000006', passwordHash: 'h', role: 'vendor' } });
      const intruder = await prisma.user.create({ data: { phone: '01940000007', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: owner.id, businessName: 'Owner H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const token = signToken({ id: intruder.id, phone: intruder.phone, role: 'vendor' });
      const patchRes = await request_(app, 'PATCH', `/api/v1/hotel-rooms/${room.id}`, { token, body: { name: 'Hacked' } });
      expect(patchRes.status).toBe(403);
      const deleteRes = await request_(app, 'DELETE', `/api/v1/hotel-rooms/${room.id}`, { token });
      expect(deleteRes.status).toBe(403);
    });
  });

  // =====================================================================
  // RATE PLAN MANAGEMENT
  // =====================================================================
  describe('Rate plan CRUD', () => {
    it('provider can create rate plan for own room', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000008', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'POST', `/api/v1/hotels/rooms/${room.id}/rate-plans`, {
        token,
        body: { name: 'Room Only', mealPlan: 'RO', refundable: true, price: 1200, currency: 'BDT', minStay: 1 }
      });
      expect(res.status).toBe(201);
      expect(res.body.plan.name).toBe('Room Only');
      expect(res.body.plan.price).toBe(1200);
    });

    it('provider can update own rate plan', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000009', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const plan = await prisma.ratePlan.create({
        data: { roomId: room.id, name: 'RO', mealPlan: 'RO', refundable: true, price: 1000, currency: 'BDT' }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'PATCH', `/api/v1/hotels/rooms/${room.id}/rate-plans/${plan.id}`, {
        token,
        body: { price: 1500, refundable: false }
      });
      expect(res.status).toBe(200);
      expect(res.body.plan.price).toBe(1500);
      expect(res.body.plan.refundable).toBe(false);
    });

    it('provider can deactivate own rate plan', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000010', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const plan = await prisma.ratePlan.create({
        data: { roomId: room.id, name: 'RO', mealPlan: 'RO', refundable: true, price: 1000, currency: 'BDT' }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'DELETE', `/api/v1/hotels/rooms/${room.id}/rate-plans/${plan.id}`, { token });
      expect(res.status).toBe(200);
      const deactivated = await prisma.ratePlan.findUnique({ where: { id: plan.id } });
      expect(deactivated?.isActive).toBe(false);
    });

    it('provider cannot modify another provider rate plan', async () => {
      const owner = await prisma.user.create({ data: { phone: '01940000011', passwordHash: 'h', role: 'vendor' } });
      const intruder = await prisma.user.create({ data: { phone: '01940000012', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: owner.id, businessName: 'Owner H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const plan = await prisma.ratePlan.create({
        data: { roomId: room.id, name: 'RO', mealPlan: 'RO', refundable: true, price: 1000, currency: 'BDT' }
      });
      const app = createApp();
      const token = signToken({ id: intruder.id, phone: intruder.phone, role: 'vendor' });
      const res = await request_(app, 'PATCH', `/api/v1/hotels/rooms/${room.id}/rate-plans/${plan.id}`, { token, body: { price: 500 } });
      expect(res.status).toBe(403);
    });
  });

  // =====================================================================
  // INVENTORY & AVAILABILITY
  // =====================================================================
  describe('Inventory and availability', () => {
    it('booking consumes inventory and cancellation restores it', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000013', passwordHash: 'h', role: 'vendor' } });
      const customer = await prisma.user.create({ data: { phone: '01840000001', passwordHash: 'h', role: 'customer' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 2000, capacity: 2, totalRooms: 2, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const bookRes = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: custToken,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1, numberOfRooms: 1 }
      });
      expect(bookRes.status).toBe(201);

      const availAfterBooking = await prisma.hotelAvailability.findUnique({
        where: { roomId_date: { roomId: room.id, date: tomorrow } }
      });
      expect(availAfterBooking?.bookedRooms).toBe(1);

      const cancelRes = await request_(app, 'PATCH', `/api/v1/hotel-bookings/${bookRes.body.booking.id}/cancel`, {
        token: custToken,
        body: { reason: 'Change of plans' }
      });
      expect(cancelRes.status).toBe(200);

      const availAfterCancel = await prisma.hotelAvailability.findUnique({
        where: { roomId_date: { roomId: room.id, date: tomorrow } }
      });
      expect(availAfterCancel?.bookedRooms).toBe(0);
    });

    it('prevents overbooking when inventory exhausted', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000014', passwordHash: 'h', role: 'vendor' } });
      const c1 = await prisma.user.create({ data: { phone: '01840000002', passwordHash: 'h', role: 'customer' } });
      const c2 = await prisma.user.create({ data: { phone: '01840000003', passwordHash: 'h', role: 'customer' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 2000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
      const t2 = signToken({ id: c2.id, phone: c2.phone, role: 'customer' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const r1 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: t1,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1, numberOfRooms: 1 }
      });
      expect(r1.status).toBe(201);

      const r2 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: t2,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1, numberOfRooms: 1 }
      });
      expect(r2.status).toBe(409);
    });

    it('rejects booking when requested rooms exceed total inventory', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000015', passwordHash: 'h', role: 'vendor' } });
      const customer = await prisma.user.create({ data: { phone: '01840000004', passwordHash: 'h', role: 'customer' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 2000, capacity: 2, totalRooms: 2, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1, numberOfRooms: 5 }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceeds total rooms/);
    });

    it('never allows negative bookedRooms', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000016', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 2000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      await prisma.hotelAvailability.create({
        data: { roomId: room.id, date: new Date(), totalRooms: 1, bookedRooms: 0, isActive: true }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'POST', `/api/v1/hotels/rooms/${room.id}/availability/bulk`, {
        token,
        body: { from: new Date().toISOString(), to: new Date(Date.now() + 86400000).toISOString(), totalRooms: 1, isActive: true }
      });
      expect(res.status).toBe(200);
      const avail = await prisma.hotelAvailability.findFirst({ where: { roomId: room.id } });
      expect(avail?.bookedRooms).toBeGreaterThanOrEqual(0);
    });
  });

  // =====================================================================
  // PUBLIC API — Approved hotel only
  // =====================================================================
  describe('Public room API visibility', () => {
    it('public room list returns rooms only for approved hotel', async () => {
      const v = await prisma.user.create({ data: { phone: '01940000017', passwordHash: 'h', role: 'vendor' } });
      const approvedHotel = await prisma.serviceProvider.create({
        data: {
          userId: v.id, businessName: 'Approved H', category: 'hotel', address: '1 St', city: 'Dhaka',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const rejectedHotel = await prisma.serviceProvider.create({
        data: {
          userId: v.id, businessName: 'Rejected H', category: 'hotel', address: '2 St', city: 'Dhaka',
          status: 'REJECTED', lifecycleStatus: 'REJECTED', isVerified: false, isActive: false, isPublished: false
        }
      });
      await prisma.room.create({
        data: { providerId: approvedHotel.id, name: 'Approved Room', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      await prisma.room.create({
        data: { providerId: rejectedHotel.id, name: 'Rejected Room', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const res = await request_(app, 'GET', `/api/v1/hotel-rooms?hotelId=${approvedHotel.id}`);
      expect(res.status).toBe(200);
      expect(res.body.rooms.every((r: any) => r.name === 'Approved Room')).toBe(true);

      const res2 = await request_(app, 'GET', `/api/v1/hotel-rooms?hotelId=${rejectedHotel.id}`);
      expect(res2.status).toBe(404);
    });

    it('public room detail excludes private provider data', async () => {
      const v = await prisma.user.create({
        data: { phone: '01940000018', passwordHash: 'h', role: 'vendor', email: 'secret@test.com' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: v.id, businessName: 'H', category: 'hotel', address: '1 St', city: 'Dhaka',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const res = await request_(app, 'GET', `/api/v1/hotel-rooms/${room.id}`);
      expect(res.status).toBe(200);
      expect(res.body.room.hotel.userId).toBeUndefined();
      expect(res.body.room.hotel.commissionRate).toBeUndefined();
      expect(res.body.room.providerId).toBeUndefined();
    });

    it('public availability returns data only for approved hotels', async () => {
      const v = await prisma.user.create({ data: { phone: '01940000019', passwordHash: 'h', role: 'vendor' } });
      const rejected = await prisma.serviceProvider.create({
        data: {
          userId: v.id, businessName: 'Rejected', category: 'hotel', address: '1 St',
          status: 'REJECTED', lifecycleStatus: 'REJECTED', isVerified: false, isActive: false, isPublished: false
        }
      });
      const room = await prisma.room.create({
        data: { providerId: rejected.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      await prisma.hotelAvailability.create({
        data: { roomId: room.id, date: new Date(), totalRooms: 1, bookedRooms: 0, isActive: true }
      });
      const app = createApp();
      const res = await request_(app, 'GET', `/api/v1/hotel-rooms/${room.id}/availability`);
      expect(res.status).toBe(404);
    });
  });

  // =====================================================================
  // PROVIDER ROOM LIST
  // =====================================================================
  describe('Provider room listing', () => {
    it('provider can list own rooms', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000020', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      await prisma.room.create({
        data: { providerId: hotel.id, name: 'R1', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      await prisma.room.create({
        data: { providerId: hotel.id, name: 'R2', type: 'DLX', price: 2000, capacity: 3, totalRooms: 2, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'GET', '/api/v1/hotel-rooms/mine', { token });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.rooms.map((r: any) => r.name).sort()).toEqual(['R1', 'R2']);
    });

    it('provider can get own room detail', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000021', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'H', category: 'hotel', address: '1 St',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'GET', `/api/v1/hotel-rooms/mine/${room.id}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.room.name).toBe('R');
      expect(res.body.room.ratePlans).toBeDefined();
    });
  });

  // =====================================================================
  // LARGE HOTEL — Multiple rooms, rate plans
  // =====================================================================
  describe('Large hotel multi-room flow', () => {
    it('supports multiple rooms and multiple rate plans per room', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000022', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'Grand Hotel', category: 'hotel', address: '1 St', city: 'Dhaka',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room1 = await prisma.room.create({
        data: { providerId: hotel.id, name: 'Deluxe', type: 'DELUXE', price: 5000, capacity: 3, totalRooms: 10, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const room2 = await prisma.room.create({
        data: { providerId: hotel.id, name: 'Suite', type: 'SUITE', price: 12000, capacity: 4, totalRooms: 5, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      await prisma.ratePlan.create({ data: { roomId: room1.id, name: 'Room Only', mealPlan: 'RO', refundable: true, price: 5000, currency: 'BDT' } });
      await prisma.ratePlan.create({ data: { roomId: room1.id, name: 'Breakfast Included', mealPlan: 'BB', refundable: true, price: 6500, currency: 'BDT' } });
      await prisma.ratePlan.create({ data: { roomId: room2.id, name: 'Suite Flexible', mealPlan: 'RO', refundable: true, price: 12000, currency: 'BDT' } });

      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const listRes = await request_(app, 'GET', '/api/v1/hotel-rooms/mine', { token });
      expect(listRes.status).toBe(200);
      expect(listRes.body.count).toBe(2);

      const r1Plans = await request_(app, 'GET', `/api/v1/hotels/rooms/${room1.id}/rate-plans`);
      expect(r1Plans.status).toBe(200);
      expect(r1Plans.body.count).toBe(2);
    });
  });

  // =====================================================================
  // LOCAL HOTEL — Simple flow
  // =====================================================================
  describe('Local hotel simple flow', () => {
    it('local hotel can create basic room with minimal fields', async () => {
      const vendor = await prisma.user.create({ data: { phone: '01940000023', passwordHash: 'h', role: 'vendor' } });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id, businessName: 'Local Guest House', category: 'hotel', address: '123 Main Rd', city: 'Dhaka',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'POST', '/api/v1/hotel-rooms', {
        token,
        body: {
          hotelId: hotel.id,
          name: 'Standard Room',
          type: 'SINGLE',
          price: 800,
          totalRooms: 3
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.room.price).toBe(800);
      expect(res.body.room.totalRooms).toBe(3);
    });
  });

  // =====================================================================
  // SECURITY — Private data protection
  // =====================================================================
  describe('Security and data isolation', () => {
    it('public room response does not expose provider internals', async () => {
      const v = await prisma.user.create({
        data: { phone: '01940000024', passwordHash: 'h', role: 'vendor', email: 'secret@test.com' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: v.id, businessName: 'H', category: 'hotel', address: '1 St', city: 'Dhaka',
          status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
        }
      });
      const room = await prisma.room.create({
        data: { providerId: hotel.id, name: 'R', type: 'STD', price: 1000, capacity: 2, totalRooms: 1, baseCurrency: 'BDT', status: 'ACTIVE' }
      });
      const app = createApp();
      const res = await request_(app, 'GET', `/api/v1/hotel-rooms/${room.id}`);
      expect(res.status).toBe(200);
      expect(res.body.room.providerId).toBeUndefined();
      expect(res.body.room.baseCurrency).toBeUndefined();
      expect(res.body.room.hotel.userId).toBeUndefined();
      expect(res.body.room.hotel.kycData).toBeUndefined();
    });
  });
});
