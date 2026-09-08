import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';
import hotelRoutes from '../src/routes/hotel.routes';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';
import hotelRoomRoutes from '../src/routes/hotel-room.routes';
import hotelBookingRoutes from '../src/routes/hotel-booking.routes';
import hotelOperationsRoutes from '../src/routes/hotel-operations.routes';
import paymentRoutes from '../src/routes/payment.routes';

process.env.BKASH_API_KEY = 'test-key';
process.env.BKASH_SECRET_KEY = 'test-secret';
process.env.BKASH_BASE_URL = 'https://sandbox.bka.sh';
process.env.PAYMENT_MODE = 'stub';

function signToken(payload: { id: number; phone: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test', { expiresIn: '2h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hotels', hotelRoutes);
  app.use('/api/v1/hotels', hotelManageRoutes);
  app.use('/api/v1/hotels', hotelOperationsRoutes);
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
  const vendor = await prisma.user.create({
    data: { phone: '01911100001', passwordHash: 'h', role: 'vendor' }
  });
  const hotel = await prisma.serviceProvider.create({
    data: {
      userId: vendor.id,
      businessName: 'Grand Palace Hotel',
      category: 'hotel',
      address: '100 Main St',
      city: 'Dhaka',
      status: 'APPROVED',
      isVerified: true,
      isActive: true,
      isPublished: true,
      lifecycleStatus: 'APPROVED'
    }
  });
  const room = await prisma.room.create({
    data: {
      providerId: hotel.id,
      name: 'Deluxe Suite',
      type: 'DELUXE',
      price: 5000,
      capacity: 2,
      adultCapacity: 2,
      childCapacity: 1,
      totalRooms: 2,
      isAvailable: true,
      baseCurrency: 'BDT',
      status: 'ACTIVE'
    }
  });
  const ratePlan = await prisma.ratePlan.create({
    data: {
      roomId: room.id,
      name: 'Bed & Breakfast (Special)',
      mealPlan: 'BB',
      refundable: true,
      price: 4200,
      currency: 'BDT',
      minStay: 1,
      maxStay: 14,
      isActive: true
    }
  });
  const customer = await prisma.user.create({
    data: { phone: '01922200001', fullName: 'Alice Rahman', passwordHash: 'h', role: 'customer' }
  });
  return { vendor, hotel, room, ratePlan, customer };
}

describe('STEP 6 — Hotel Booking Engine, Rate Plans, Inventory & Reservation Integrity', () => {
  jest.setTimeout(30000);
  let app: express.Express;

  beforeAll(async () => {
    await prisma.$connect();
    app = createApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanup();
  });

  // =========================================================================
  // 1. RATE PLAN PRICING INTEGRITY
  // =========================================================================
  describe('Phase 1: RatePlan Pricing Integrity', () => {
    it('uses RatePlan price (4200) instead of Room base price (5000) for booking calculation', async () => {
      const { hotel, room, ratePlan, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 2); // 2 nights

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          ratePlanId: ratePlan.id,
          checkIn: tomorrow.toISOString(),
          checkOut: dayAfter.toISOString(),
          numberOfGuests: 2,
          numberOfRooms: 1
        }
      });

      expect(res.status).toBe(201);
      expect(res.body.booking).toBeDefined();
      expect(res.body.booking.ratePlanId).toBe(ratePlan.id);
      expect(res.body.booking.totalAmount).toBe(8400); // 4200 * 2 nights
      expect(res.body.booking.finalAmount).toBe(8400);

      // Verify persisted database record
      const dbBooking = await prisma.booking.findUnique({ where: { id: res.body.booking.id } });
      expect(dbBooking).not.toBeNull();
      expect(dbBooking?.ratePlanId).toBe(ratePlan.id);
      expect(dbBooking?.finalAmount).toBe(8400);

      const snapshot = JSON.parse(dbBooking?.priceSnapshot || '{}');
      expect(snapshot.ratePlanId).toBe(ratePlan.id);
      expect(snapshot.ratePlanPrice).toBe(4200);
      expect(snapshot.nightlyRate).toBe(4200);
      expect(snapshot.nights).toBe(2);
      expect(snapshot.finalAmount).toBe(8400);
    });

    it('rejects booking with non-existent ratePlanId', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          ratePlanId: 999999,
          checkIn: tomorrow.toISOString(),
          checkOut: dayAfter.toISOString(),
          numberOfGuests: 1
        }
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/rate plan/i);
    });

    it('rejects booking with inactive ratePlanId', async () => {
      const { hotel, room, customer } = await setupWorld();
      const inactivePlan = await prisma.ratePlan.create({
        data: {
          roomId: room.id,
          name: 'Inactive Promo',
          price: 3000,
          isActive: false
        }
      });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          ratePlanId: inactivePlan.id,
          checkIn: tomorrow.toISOString(),
          checkOut: dayAfter.toISOString(),
          numberOfGuests: 1
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/inactive/i);
    });

    it('rejects booking when ratePlan belongs to a different room (cross-room IDOR)', async () => {
      const { hotel, room, customer } = await setupWorld();
      const otherRoom = await prisma.room.create({
        data: {
          providerId: hotel.id,
          name: 'Economy Room',
          type: 'ECO',
          price: 2000,
          status: 'ACTIVE'
        }
      });
      const otherPlan = await prisma.ratePlan.create({
        data: {
          roomId: otherRoom.id,
          name: 'Eco Plan',
          price: 1800,
          isActive: true
        }
      });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      // Attempting to book Deluxe Suite with Economy Plan
      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          ratePlanId: otherPlan.id,
          checkIn: tomorrow.toISOString(),
          checkOut: dayAfter.toISOString(),
          numberOfGuests: 1
        }
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/rate plan/i);
    });

    it('enforces minStay restriction on RatePlan', async () => {
      const { hotel, room, customer } = await setupWorld();
      const min3StayPlan = await prisma.ratePlan.create({
        data: {
          roomId: room.id,
          name: '3-Night Minimum Discount',
          price: 3500,
          minStay: 3,
          isActive: true
        }
      });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1); // 1 night stay

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          ratePlanId: min3StayPlan.id,
          checkIn: tomorrow.toISOString(),
          checkOut: dayAfter.toISOString(),
          numberOfGuests: 1
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/minimum stay/i);
    });

    it('server ignores client-submitted price manipulation and calculates server-side amount', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkIn: tomorrow.toISOString(),
          checkOut: dayAfter.toISOString(),
          numberOfGuests: 1,
          totalAmount: 1, // Malicious attempt to pay 1 BDT
          finalAmount: 1
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.booking.finalAmount).toBe(5000); // Authoritative server calculation
    });
  });

  // =========================================================================
  // 2. DATE & RESERVATION VALIDATION
  // =========================================================================
  describe('Phase 2: Date & Reservation Validation', () => {
    it('rejects booking when check-out date is before check-in date', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 2);
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() + 1);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkIn: tomorrow.toISOString(),
          checkOut: yesterday.toISOString(),
          numberOfGuests: 1
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/check-out must be after check-in/i);
    });

    it('rejects same-day check-in and check-out (0 nights stay)', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const future = new Date(); future.setDate(future.getDate() + 3); future.setHours(0, 0, 0, 0);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkIn: future.toISOString(),
          checkOut: future.toISOString(),
          numberOfGuests: 1
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/check-out must be after check-in/i);
    });

    it('rejects past check-in dates', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const past = new Date(); past.setDate(past.getDate() - 2); past.setHours(0, 0, 0, 0);
      const pastOut = new Date(); pastOut.setDate(pastOut.getDate() - 1); pastOut.setHours(0, 0, 0, 0);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkIn: past.toISOString(),
          checkOut: pastOut.toISOString(),
          numberOfGuests: 1
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/past/i);
    });

    it('rejects stay duration exceeding 365 nights', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const inDate = new Date(); inDate.setDate(inDate.getDate() + 1); inDate.setHours(0, 0, 0, 0);
      const outDate = new Date(inDate); outDate.setDate(outDate.getDate() + 400);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkIn: inDate.toISOString(),
          checkOut: outDate.toISOString(),
          numberOfGuests: 1
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/365/i);
    });

    it('rejects booking when guests exceed total room capacity (adult + child)', async () => {
      const { hotel, room, customer } = await setupWorld(); // adultCapacity=2, childCapacity=1 => max 3
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkIn: tomorrow.toISOString(),
          checkOut: dayAfter.toISOString(),
          numberOfGuests: 5 // exceeds 3
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/capacity/i);
    });
  });

  // =========================================================================
  // 3. INVENTORY & AVAILABILITY INTEGRITY
  // =========================================================================
  describe('Phase 3: Inventory & Availability Integrity', () => {
    it('correctly tracks and exhausts inventory across multiple bookings', async () => {
      const { hotel, room } = await setupWorld(); // totalRooms = 2
      const c1 = await prisma.user.create({ data: { phone: '01930000001', passwordHash: 'h', role: 'customer' } });
      const c2 = await prisma.user.create({ data: { phone: '01930000002', passwordHash: 'h', role: 'customer' } });
      const c3 = await prisma.user.create({ data: { phone: '01930000003', passwordHash: 'h', role: 'customer' } });

      const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
      const t2 = signToken({ id: c2.id, phone: c2.phone, role: 'customer' });
      const t3 = signToken({ id: c3.id, phone: c3.phone, role: 'customer' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const body = {
        hotelId: hotel.id,
        roomId: room.id,
        checkIn: tomorrow.toISOString(),
        checkOut: dayAfter.toISOString(),
        numberOfGuests: 1,
        numberOfRooms: 1
      };

      // 1st room booked -> 201
      const r1 = await request_(app, 'POST', '/api/v1/hotel-bookings', { token: t1, body });
      expect(r1.status).toBe(201);

      // 2nd room booked -> 201
      const r2 = await request_(app, 'POST', '/api/v1/hotel-bookings', { token: t2, body });
      expect(r2.status).toBe(201);

      // 3rd attempt on exhausted inventory -> 409
      const r3 = await request_(app, 'POST', '/api/v1/hotel-bookings', { token: t3, body });
      expect(r3.status).toBe(409);
      expect(r3.body.error).toMatch(/not available/i);
    });

    it('rejects multi-room booking that exceeds remaining inventory', async () => {
      const { hotel, room, customer } = await setupWorld(); // totalRooms = 2
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkIn: tomorrow.toISOString(),
          checkOut: dayAfter.toISOString(),
          numberOfGuests: 1,
          numberOfRooms: 3 // Room only has 2
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceeds total rooms/i);
    });

    it('cancellation releases inventory and allows subsequent booking to succeed', async () => {
      const { hotel, room } = await setupWorld(); // totalRooms = 2
      const c1 = await prisma.user.create({ data: { phone: '01930000004', passwordHash: 'h', role: 'customer' } });
      const c2 = await prisma.user.create({ data: { phone: '01930000005', passwordHash: 'h', role: 'customer' } });
      const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
      const t2 = signToken({ id: c2.id, phone: c2.phone, role: 'customer' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      // Book all 2 rooms
      const b1 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: t1,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 2, numberOfRooms: 2 }
      });
      expect(b1.status).toBe(201);

      // C2 attempt fails
      const f1 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: t2,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1, numberOfRooms: 1 }
      });
      expect(f1.status).toBe(409);

      // C1 cancels booking
      const cancelRes = await request_(app, 'PATCH', `/api/v1/hotel-bookings/${b1.body.booking.id}/cancel`, {
        token: t1,
        body: { reason: 'Trip postponed' }
      });
      expect(cancelRes.status).toBe(200);

      // C2 attempts again -> succeeds now
      const s2 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: t2,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1, numberOfRooms: 1 }
      });
      expect(s2.status).toBe(201);
    });

    it('rejects booking when room is marked MAINTENANCE or OUT_OF_SERVICE', async () => {
      const { hotel, room, customer } = await setupWorld();
      await prisma.room.update({
        where: { id: room.id },
        data: { status: 'MAINTENANCE', isAvailable: false }
      });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/available/i);
    });

    it('rejects booking when HotelAvailability for date is inactive', async () => {
      const { hotel, room, customer } = await setupWorld();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      await prisma.hotelAvailability.create({
        data: {
          roomId: room.id,
          date: tomorrow,
          totalRooms: 2,
          bookedRooms: 0,
          isActive: false // Vendor closed inventory on this date
        }
      });

      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/unavailable/i);
    });
  });

  // =========================================================================
  // 4. CONCURRENT BOOKING / OVERSELLING PROTECTION
  // =========================================================================
  describe('Phase 4: Concurrency & Overselling Protection', () => {
    it('prevents overselling when two users submit concurrent bookings for the last remaining room', async () => {
      const { hotel, room } = await setupWorld();
      // Set room totalRooms to 1
      await prisma.room.update({ where: { id: room.id }, data: { totalRooms: 1 } });

      const c1 = await prisma.user.create({ data: { phone: '01940000001', passwordHash: 'h', role: 'customer' } });
      const c2 = await prisma.user.create({ data: { phone: '01940000002', passwordHash: 'h', role: 'customer' } });
      const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
      const t2 = signToken({ id: c2.id, phone: c2.phone, role: 'customer' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const body = {
        hotelId: hotel.id,
        roomId: room.id,
        checkIn: tomorrow.toISOString(),
        checkOut: dayAfter.toISOString(),
        numberOfGuests: 1,
        numberOfRooms: 1
      };

      // Fire both booking requests in parallel
      const [res1, res2] = await Promise.all([
        request_(app, 'POST', '/api/v1/hotel-bookings', { token: t1, body }),
        request_(app, 'POST', '/api/v1/hotel-bookings', { token: t2, body })
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      // Verify database state: exactly 1 booking created
      const count = await prisma.booking.count({
        where: { roomId: room.id, status: { in: ['pending', 'confirmed', 'paid'] } }
      });
      expect(count).toBe(1);

      // Verify availability record never exceeded 1
      const avail = await prisma.hotelAvailability.findUnique({
        where: { roomId_date: { roomId: room.id, date: tomorrow } }
      });
      expect(avail?.bookedRooms).toBe(1);
    });
  });

  // =========================================================================
  // 5. BOOKING STATE MACHINE & LIFECYCLE
  // =========================================================================
  describe('Phase 5: Booking State Machine & Lifecycle', () => {
    it('executes the complete valid lifecycle: pending -> paid -> confirmed -> checked-in -> completed', async () => {
      const { hotel, room, customer, vendor } = await setupWorld();
      const cToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      // 1. Create booking (status: pending, paymentStatus: pending)
      const bookRes = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: cToken,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      expect(bookRes.status).toBe(201);
      const bookingId = bookRes.body.booking.id;

      // 2. Initiate payment
      const initRes = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: cToken,
        body: { bookingId, method: 'bkash', amount: 5000 }
      });
      expect(initRes.status).toBe(201);
      const txId = initRes.body.transactionId;

      // 3. Verify payment (status: confirmed, paymentStatus: paid)
      const verifyRes = await request_(app, 'POST', '/api/v1/payments/verify', {
        token: cToken,
        body: { transactionId: txId }
      });
      expect(verifyRes.status).toBe(200);

      const paidBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(paidBooking?.status).toBe('confirmed');
      expect(paidBooking?.paymentStatus).toBe('paid');

      // 4. Check-in (vendor)
      const inRes = await request_(app, 'POST', '/api/v1/hotels/check-in', {
        token: vToken,
        body: { bookingId }
      });
      expect(inRes.status).toBe(200);

      // 5. Check-out (vendor)
      const outRes = await request_(app, 'POST', '/api/v1/hotels/check-out', {
        token: vToken,
        body: { bookingId }
      });
      expect(outRes.status).toBe(200);

      const completedBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(completedBooking?.status).toBe('completed');
    });

    it('rejects duplicate cancellation attempt', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });

      const c1 = await request_(app, 'PATCH', `/api/v1/hotel-bookings/${b.body.booking.id}/cancel`, { token });
      expect(c1.status).toBe(200);

      const c2 = await request_(app, 'PATCH', `/api/v1/hotel-bookings/${b.body.booking.id}/cancel`, { token });
      expect(c2.status).toBe(400);
      expect(c2.body.error).toMatch(/cannot cancel status cancelled/i);
    });

    it('rejects cancellation on a completed booking', async () => {
      const { hotel, room, customer } = await setupWorld();
      const booking = await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: hotel.id,
          roomId: room.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: new Date(),
          returnDate: new Date(),
          numberOfPeople: 1,
          totalAmount: 5000,
          finalAmount: 5000,
          status: 'completed',
          paymentStatus: 'paid'
        }
      });

      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const cancelRes = await request_(app, 'PATCH', `/api/v1/hotel-bookings/${booking.id}/cancel`, { token });
      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.error).toMatch(/cannot cancel status completed/i);
    });
  });

  // =========================================================================
  // 6. PAYMENT SAFETY
  // =========================================================================
  describe('Phase 6: Payment Safety', () => {
    it('payment verification is idempotent on duplicate calls', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const bookingId = b.body.booking.id;

      const init = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token,
        body: { bookingId, method: 'bkash', amount: 5000 }
      });
      const txId = init.body.transactionId;

      const v1 = await request_(app, 'POST', '/api/v1/payments/verify', { token, body: { transactionId: txId } });
      expect(v1.status).toBe(200);

      const v2 = await request_(app, 'POST', '/api/v1/payments/verify', { token, body: { transactionId: txId } });
      expect(v2.status).toBe(200);
      expect(v2.body.status).toBe('success');
    });

    it('rejects payment initiation for cancelled booking', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const bookingId = b.body.booking.id;

      // Cancel before payment
      await request_(app, 'PATCH', `/api/v1/hotel-bookings/${bookingId}/cancel`, { token });

      // Attempt payment initiation
      const init = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token,
        body: { bookingId, method: 'bkash', amount: 5000 }
      });
      expect(init.status).toBe(400);
      expect(init.body.error).toMatch(/cancelled/i);
    });

    it('rejects payment verification if booking was cancelled after initiation', async () => {
      const { hotel, room, customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const bookingId = b.body.booking.id;

      const init = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token,
        body: { bookingId, method: 'bkash', amount: 5000 }
      });
      const txId = init.body.transactionId;

      // User cancels booking before completing checkout
      await request_(app, 'PATCH', `/api/v1/hotel-bookings/${bookingId}/cancel`, { token });

      // Verification attempt must be rejected
      const verify = await request_(app, 'POST', '/api/v1/payments/verify', {
        token,
        body: { transactionId: txId }
      });
      expect(verify.status).toBe(400);
      expect(verify.body.error).toMatch(/cancelled/i);
    });
  });

  // =========================================================================
  // 7. PROVIDER & TENANT ISOLATION (IDOR)
  // =========================================================================
  describe('Phase 7: Provider & Tenant Isolation', () => {
    it('prevents customer A from viewing customer B private hotel booking', async () => {
      const { hotel, room } = await setupWorld();
      const cA = await prisma.user.create({ data: { phone: '01950000001', passwordHash: 'h', role: 'customer' } });
      const cB = await prisma.user.create({ data: { phone: '01950000002', passwordHash: 'h', role: 'customer' } });
      const tA = signToken({ id: cA.id, phone: cA.phone, role: 'customer' });
      const tB = signToken({ id: cB.id, phone: cB.phone, role: 'customer' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      // Customer A books
      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tA,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const bookingId = b.body.booking.id;

      // Customer B tries to view Customer A's booking
      const getRes = await request_(app, 'GET', `/api/v1/hotel-bookings/${bookingId}`, { token: tB });
      expect(getRes.status).toBe(403);
      expect(getRes.body.error).toMatch(/access denied/i);
    });

    it('prevents customer A from cancelling customer B hotel booking', async () => {
      const { hotel, room } = await setupWorld();
      const cA = await prisma.user.create({ data: { phone: '01950000003', passwordHash: 'h', role: 'customer' } });
      const cB = await prisma.user.create({ data: { phone: '01950000004', passwordHash: 'h', role: 'customer' } });
      const tA = signToken({ id: cA.id, phone: cA.phone, role: 'customer' });
      const tB = signToken({ id: cB.id, phone: cB.phone, role: 'customer' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tA,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const bookingId = b.body.booking.id;

      // Customer B attempts cancel
      const cancelRes = await request_(app, 'PATCH', `/api/v1/hotel-bookings/${bookingId}/cancel`, { token: tB });
      expect(cancelRes.status).toBe(403);
    });

    it('prevents provider B from managing or cancelling provider A bookings', async () => {
      const { hotel, room, customer } = await setupWorld();
      const otherVendor = await prisma.user.create({ data: { phone: '01950000005', passwordHash: 'h', role: 'vendor' } });
      const tCust = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const tOtherVendor = signToken({ id: otherVendor.id, phone: otherVendor.phone, role: 'vendor' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: tCust,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const bookingId = b.body.booking.id;

      // Other vendor tries to cancel provider A's booking
      const cancelRes = await request_(app, 'PATCH', `/api/v1/hotel-bookings/${bookingId}/cancel`, { token: tOtherVendor });
      expect(cancelRes.status).toBe(403);

      // Other vendor lists vendor bookings -> does not see provider A's booking
      const listRes = await request_(app, 'GET', '/api/v1/hotel-bookings/vendor/mine', { token: tOtherVendor });
      expect(listRes.status).toBe(200);
      expect(listRes.body.count).toBe(0);
    });

    it('rejects unauthenticated access to protected hotel booking endpoints', async () => {
      const { hotel, room } = await setupWorld();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated access to protected hotel management endpoints', async () => {
      const res = await request_(app, 'GET', '/api/v1/hotels/my');
      expect(res.status).toBe(401);
    });

    it('rejects customer role from accessing vendor hotel management', async () => {
      const { customer } = await setupWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const res = await request_(app, 'GET', '/api/v1/hotels/my', { token });
      expect(res.status).toBe(403);
    });

    it('rejects invalid state transition: check-in on already checked-in booking', async () => {
      const { hotel, room, customer, vendor } = await setupWorld();
      const cToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: cToken,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const bookingId = b.body.booking.id;

      // Initiate and verify payment
      const init = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: cToken,
        body: { bookingId, method: 'bkash', amount: 5000 }
      });
      await request_(app, 'POST', '/api/v1/payments/verify', {
        token: cToken,
        body: { transactionId: init.body.transactionId }
      });

      // First check-in succeeds
      const in1 = await request_(app, 'POST', '/api/v1/hotels/check-in', { token: vToken, body: { bookingId } });
      expect(in1.status).toBe(200);

      // Second check-in must fail
      const in2 = await request_(app, 'POST', '/api/v1/hotels/check-in', { token: vToken, body: { bookingId } });
      expect(in2.status).toBe(400);
      expect(in2.body.error).toMatch(/already checked in/i);
    });

    it('rejects check-out before check-in', async () => {
      const { hotel, room, customer, vendor } = await setupWorld();
      const cToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

      const b = await request_(app, 'POST', '/api/v1/hotel-bookings', {
        token: cToken,
        body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
      });
      const bookingId = b.body.booking.id;

      // Initiate and verify payment
      const init = await request_(app, 'POST', '/api/v1/payments/initiate', {
        token: cToken,
        body: { bookingId, method: 'bkash', amount: 5000 }
      });
      await request_(app, 'POST', '/api/v1/payments/verify', {
        token: cToken,
        body: { transactionId: init.body.transactionId }
      });

      // Check-out without check-in must fail
      const out = await request_(app, 'POST', '/api/v1/hotels/check-out', { token: vToken, body: { bookingId } });
      expect(out.status).toBe(400);
      expect(out.body.error).toMatch(/must be checked in/i);
    });

    it('rejects provider B from managing provider A hotel rooms', async () => {
      const { hotel, room, customer } = await setupWorld();
      const otherVendor = await prisma.user.create({ data: { phone: '01950000006', passwordHash: 'h', role: 'vendor' } });
      const tOtherVendor = signToken({ id: otherVendor.id, phone: otherVendor.phone, role: 'vendor' });

      const res = await request_(app, 'PATCH', `/api/v1/hotel-rooms/${room.id}`, {
        token: tOtherVendor,
        body: { price: 9999 }
      });
      expect(res.status).toBe(403);
    });

    it('rejects provider B from managing provider A rate plans', async () => {
      const { hotel, room, customer } = await setupWorld();
      const otherVendor = await prisma.user.create({ data: { phone: '01950000007', passwordHash: 'h', role: 'vendor' } });
      const tOtherVendor = signToken({ id: otherVendor.id, phone: otherVendor.phone, role: 'vendor' });

      const plan = await prisma.ratePlan.create({
        data: { roomId: room.id, name: 'Test Plan', price: 4000, isActive: true }
      });

      const res = await request_(app, 'PATCH', `/api/v1/hotels/rooms/${room.id}/rate-plans/${plan.id}`, {
        token: tOtherVendor,
        body: { price: 9999 }
      });
       expect(res.status).toBe(403);
    });

    // =========================================================================
    // 6. CONCURRENT BOOKING & AVAILABILITY CONFLICT PROTECTION
    // =========================================================================
    describe('Phase 6: Concurrent Booking & Availability Protection', () => {
      it('allows second booking when room still has capacity (totalRooms=2)', async () => {
        const { hotel, room, customer } = await setupWorld();
        const otherCustomer = await prisma.user.create({
          data: { phone: '01922200009', fullName: 'Bob Karim', passwordHash: 'h', role: 'customer' }
        });

        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
        const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
        const checkIn = tomorrow.toISOString();
        const checkOut = dayAfter.toISOString();

        const t1 = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
        const t2 = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: 'customer' });

        const b1 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
          token: t1, body: { hotelId: hotel.id, roomId: room.id, checkIn, checkOut, numberOfGuests: 1 }
        });
        expect(b1.status).toBe(201);

        const b2 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
          token: t2, body: { hotelId: hotel.id, roomId: room.id, checkIn, checkOut, numberOfGuests: 1 }
        });
        expect(b2.status).toBe(201);
      });

      it('rejects booking when room is fully booked (overbooking protection)', async () => {
        const { hotel, room, customer } = await setupWorld();

        const c1 = await prisma.user.create({ data: { phone: '01922200010', fullName: 'C1', passwordHash: 'h', role: 'customer' } });
        const c2 = await prisma.user.create({ data: { phone: '01922200011', fullName: 'C2', passwordHash: 'h', role: 'customer' } });
        const c3 = await prisma.user.create({ data: { phone: '01922200012', fullName: 'C3', passwordHash: 'h', role: 'customer' } });

        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
        const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
        const checkIn = tomorrow.toISOString();
        const checkOut = dayAfter.toISOString();

        const b1 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
          token: signToken({ id: c1.id, phone: c1.phone, role: 'customer' }),
          body: { hotelId: hotel.id, roomId: room.id, checkIn, checkOut, numberOfGuests: 1 }
        });
        expect(b1.status).toBe(201);

        const b2 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
          token: signToken({ id: c2.id, phone: c2.phone, role: 'customer' }),
          body: { hotelId: hotel.id, roomId: room.id, checkIn, checkOut, numberOfGuests: 1 }
        });
        expect(b2.status).toBe(201);

        const b3 = await request_(app, 'POST', '/api/v1/hotel-bookings', {
          token: signToken({ id: c3.id, phone: c3.phone, role: 'customer' }),
          body: { hotelId: hotel.id, roomId: room.id, checkIn, checkOut, numberOfGuests: 1 }
        });
        expect(b3.status).toBe(409);
      });

      it('allows concurrent bookings to succeed simultaneously (race condition on same date)', async () => {
        const { hotel, room } = await setupWorld();

        const c1 = await prisma.user.create({ data: { phone: '01922200020', fullName: 'R1', passwordHash: 'h', role: 'customer' } });
        const c2 = await prisma.user.create({ data: { phone: '01922200021', fullName: 'R2', passwordHash: 'h', role: 'customer' } });

        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
        const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
        const checkIn = tomorrow.toISOString();
        const checkOut = dayAfter.toISOString();

        const body = { hotelId: hotel.id, roomId: room.id, checkIn, checkOut, numberOfGuests: 1 };
        const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
        const t2 = signToken({ id: c2.id, phone: c2.phone, role: 'customer' });

        const [r1, r2] = await Promise.all([
          request_(app, 'POST', '/api/v1/hotel-bookings', { token: t1, body }),
          request_(app, 'POST', '/api/v1/hotel-bookings', { token: t2, body })
        ]);

        const statuses = [r1.status, r2.status].sort();
        expect(statuses).toEqual([201, 201]);

        const count = await prisma.booking.count({ where: { providerId: hotel.id, category: 'hotel' } });
        expect(count).toBe(2);
      });
    });

    // =========================================================================
    // 7. AUTHORIZATION GAP PROTECTION
    // =========================================================================
    describe('Phase 7: Authorization Gap Protection', () => {
      it('rejects customer from accessing hotel operational-status', async () => {
        const { hotel, room, customer } = await setupWorld();
        const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

        const res = await request_(app, 'POST', `/api/v1/hotels/rooms/${room.id}/operational-status`, {
          token,
          body: { status: 'CLEANING' }
        });
        expect(res.status).toBe(403);
      });

      it('rejects customer from accessing housekeeping endpoints', async () => {
        const { hotel, room, customer } = await setupWorld();
        await prisma.housekeepingTask.create({
          data: { providerId: hotel.id, roomId: room.id, notes: 'Clean room', status: 'PENDING' }
        });
        const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

        const res = await request_(app, 'GET', '/api/v1/hotels/housekeeping', { token });
        expect(res.status).toBe(403);
      });

      it('rejects customer from accessing maintenance endpoints', async () => {
        const { hotel, room, customer } = await setupWorld();
        const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

        const res = await request_(app, 'GET', '/api/v1/hotels/maintenance', { token });
        expect(res.status).toBe(403);
      });

      it('rejects customer from accessing staff endpoints', async () => {
        const { hotel, room, customer } = await setupWorld();
        const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

        const res = await request_(app, 'GET', '/api/v1/hotels/staff', { token });
        expect(res.status).toBe(403);
      });

      it('rejects customer from accessing dashboard/summary', async () => {
        const { hotel, room, customer } = await setupWorld();
        const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

        const res = await request_(app, 'GET', '/api/v1/hotels/dashboard/summary', { token });
        expect(res.status).toBe(403);
      });

      it('rejects provider B from viewing provider A housekeeping tasks', async () => {
        const { hotel, room } = await setupWorld();
        const owner = await prisma.user.create({ data: { phone: '01911100099', passwordHash: 'h', role: 'vendor' } });
        const competitor = await prisma.user.create({ data: { phone: '01911100098', passwordHash: 'h', role: 'vendor' } });
        const otherHotel = await prisma.serviceProvider.create({
          data: { userId: competitor.id, businessName: 'Other Hotel', category: 'hotel', address: '', city: 'Dhaka', status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED' }
        });
        await prisma.housekeepingTask.create({
          data: { providerId: hotel.id, roomId: room.id, notes: 'Clean room', status: 'PENDING' }
        });
        const token = signToken({ id: competitor.id, phone: competitor.phone, role: 'vendor' });

        const res = await request_(app, 'GET', '/api/v1/hotels/housekeeping', { token });
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
      });
    });
  });
});
