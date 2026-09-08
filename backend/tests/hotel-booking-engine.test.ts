import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';
import hotelRoutes from '../src/routes/hotel.routes';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';
import hotelBookingRoutes from '../src/routes/hotel-booking.routes';

function signToken(payload: { id: number; phone: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test', { expiresIn: '2h' });
}
function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hotels', hotelRoutes);
  app.use('/api/v1/hotels', hotelManageRoutes);
  app.use('/api/v1/hotel-bookings', hotelBookingRoutes);
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
  await prisma.serviceProvider.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
}

async function setupHotel(opts: { rooms?: number } = {}) {
  const vendor = await prisma.user.create({
    data: { phone: '01911100001', passwordHash: 'h', role: 'vendor' }
  });
  const hotel = await prisma.serviceProvider.create({
    data: {
      userId: vendor.id,
      businessName: 'H',
      category: 'hotel',
      address: '1 St',
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
      name: 'STD',
      type: 'STD',
      price: 2000,
      capacity: 2,
      adultCapacity: 2,
      childCapacity: 0,
      totalRooms: opts.rooms ?? 1,
      isAvailable: true,
      baseCurrency: 'BDT',
      status: 'ACTIVE'
    }
  });
  return { vendor, hotel, room };
}

describe('STEP 6 — Hotel Booking Engine', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await cleanup(); });

  it('creates a hotel booking with price snapshot', async () => {
    const { hotel, room } = await setupHotel({ rooms: 2 });
    const customer = await prisma.user.create({
      data: { phone: '01922200001', passwordHash: 'h', role: 'customer' }
    });
    const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 2);

    const app = createApp();
    const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
      token,
      body: {
        hotelId: hotel.id,
        roomId: room.id,
        checkIn: tomorrow.toISOString(),
        checkOut: dayAfter.toISOString(),
        numberOfGuests: 1,
        numberOfRooms: 1
      }
    });
    expect(res.status).toBe(201);
    expect(res.body.booking).toBeDefined();
    expect(res.body.booking.status).toBe('pending');
    expect(res.body.booking.priceSnapshot).toBeDefined();

    const snap = JSON.parse(res.body.booking.priceSnapshot);
    expect(snap.nights).toBe(2);
    expect(snap.roomPrice).toBe(2000);
    expect(snap.source).toBe('ETP');
  });

  it('prevents overbooking when capacity reached', async () => {
    const { hotel, room } = await setupHotel({ rooms: 1 });
    const c1 = await prisma.user.create({ data: { phone: '01922200001', passwordHash: 'h', role: 'customer' } });
    const c2 = await prisma.user.create({ data: { phone: '01922200002', passwordHash: 'h', role: 'customer' } });
    const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
    const t2 = signToken({ id: c2.id, phone: c2.phone, role: 'customer' });
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

    const body = {
      hotelId: hotel.id,
      roomId: room.id,
      checkIn: tomorrow.toISOString(),
      checkOut: dayAfter.toISOString(),
      numberOfGuests: 1
    };
    const app = createApp();
    const r1 = await request_(app, 'POST', '/api/v1/hotel-bookings', { token: t1, body });
    expect(r1.status).toBe(201);
    const r2 = await request_(app, 'POST', '/api/v1/hotel-bookings', { token: t2, body });
    expect(r2.status).toBe(409);
  });

  it('rejects booking for non-existent hotel', async () => {
    const customer = await prisma.user.create({ data: { phone: '01922200003', passwordHash: 'h', role: 'customer' } });
    const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
    const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
      token,
      body: { hotelId: 99999, roomId: 99999, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
    });
    expect(res.status).toBe(404);
  });

  it('rejects booking with invalid date range', async () => {
    const { hotel, room } = await setupHotel();
    const customer = await prisma.user.create({ data: { phone: '01922200004', passwordHash: 'h', role: 'customer' } });
    const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
    const app = createApp();
    const t = new Date(); t.setDate(t.getDate() + 2); t.setHours(0, 0, 0, 0);
    const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
      token,
      body: { hotelId: hotel.id, roomId: room.id, checkIn: t.toISOString(), checkOut: t.toISOString(), numberOfGuests: 1 }
    });
    expect(res.status).toBe(400);
  });

  it('customer cannot access other customer bookings', async () => {
    const { hotel, room } = await setupHotel();
    const c1 = await prisma.user.create({ data: { phone: '01922200005', passwordHash: 'h', role: 'customer' } });
    const c2 = await prisma.user.create({ data: { phone: '01922200006', passwordHash: 'h', role: 'customer' } });
    const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
    const t2 = signToken({ id: c2.id, phone: c2.phone, role: 'customer' });
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
    const r = await request_(app, 'POST', '/api/v1/hotel-bookings', {
      token: t1,
      body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
    });
    expect(r.status).toBe(201);
    const id = r.body.booking.id;

    const get = await request_(app, 'GET', `/api/v1/hotel-bookings/${id}`, { token: t2 });
    expect(get.status).toBe(403);
  });

  it('cancels booking and releases inventory', async () => {
    const { hotel, room } = await setupHotel({ rooms: 2 });
    const c1 = await prisma.user.create({ data: { phone: '01922200007', passwordHash: 'h', role: 'customer' } });
    const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
    const r = await request_(app, 'POST', '/api/v1/hotel-bookings', {
      token: t1,
      body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1, numberOfRooms: 2 }
    });
    expect(r.status).toBe(201);

    const avail = await prisma.hotelAvailability.findUnique({
      where: { roomId_date: { roomId: room.id, date: tomorrow } }
    });
    expect(avail?.bookedRooms).toBe(2);

    const cancel = await request_(app, 'PATCH', `/api/v1/hotel-bookings/${r.body.booking.id}/cancel`, {
      token: t1,
      body: { reason: 'Change of plans' }
    });
    expect(cancel.status).toBe(200);

    const avail2 = await prisma.hotelAvailability.findUnique({
      where: { roomId_date: { roomId: room.id, date: tomorrow } }
    });
    expect(avail2?.bookedRooms).toBe(0);
  });

  it('customer lists own hotel bookings', async () => {
    const { hotel, room } = await setupHotel();
    const c1 = await prisma.user.create({ data: { phone: '01922200008', passwordHash: 'h', role: 'customer' } });
    const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
    await request_(app, 'POST', '/api/v1/hotel-bookings', {
      token: t1,
      body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
    });
    const list = await request_(app, 'GET', '/api/v1/hotel-bookings/customer/mine', { token: t1 });
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);
    expect(list.body.bookings[0].category).toBe('hotel');
  });

  it('vendor lists own hotel bookings but cannot see other vendor', async () => {
    const { hotel, room, vendor } = await setupHotel();
    const c1 = await prisma.user.create({ data: { phone: '01922200009', passwordHash: 'h', role: 'customer' } });
    const t1 = signToken({ id: c1.id, phone: c1.phone, role: 'customer' });
    const tv = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
    await request_(app, 'POST', '/api/v1/hotel-bookings', {
      token: t1,
      body: { hotelId: hotel.id, roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfGuests: 1 }
    });
    const list = await request_(app, 'GET', '/api/v1/hotel-bookings/vendor/mine', { token: tv });
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);

    // Different vendor sees nothing
    const otherVendor = await prisma.user.create({ data: { phone: '01933300001', passwordHash: 'h', role: 'vendor' } });
    const tov = signToken({ id: otherVendor.id, phone: otherVendor.phone, role: 'vendor' });
    const list2 = await request_(app, 'GET', '/api/v1/hotel-bookings/vendor/mine', { token: tov });
    expect(list2.status).toBe(200);
    expect(list2.body.count).toBe(0);
  });

  it('applies promotion code and reduces price', async () => {
    const { hotel, room } = await setupHotel();
    const p = await prisma.hotelPromotion.create({
      data: {
        providerId: hotel.id,
        code: 'WELCOME10',
        name: 'Welcome',
        discountType: 'percentage',
        discountValue: 10,
        minNights: 1,
        minAmount: 0,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000),
        isActive: true
      }
    });
    const customer = await prisma.user.create({ data: { phone: '01922200010', passwordHash: 'h', role: 'customer' } });
    const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 2);
    const res = await request_(app, 'POST', '/api/v1/hotel-bookings', {
      token,
      body: {
        hotelId: hotel.id,
        roomId: room.id,
        checkIn: tomorrow.toISOString(),
        checkOut: dayAfter.toISOString(),
        numberOfGuests: 1,
        promoCode: 'welcome10'
      }
    });
    expect(res.status).toBe(201);
    expect(res.body.booking.promotionCode).toBe('WELCOME10');
    const snap = JSON.parse(res.body.booking.priceSnapshot);
    expect(snap.discountAmount).toBeGreaterThan(0);
    // Promotion usedCount is reserved at booking time but only consumed on successful payment
    const promoAfter = await prisma.hotelPromotion.findUnique({ where: { id: p.id } });
    expect(promoAfter?.usedCount).toBe(0);
  });
});
