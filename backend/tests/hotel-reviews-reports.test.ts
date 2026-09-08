import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';
import hotelRoutes from '../src/routes/hotel.routes';

function signToken(payload: { id: number; phone: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test', { expiresIn: '2h' });
}
function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hotels', hotelRoutes);
  return app;
}
function req(app: express.Express, method: string, path: string, opts: { token?: string; body?: any } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as { port: number };
      const data = opts.body ? JSON.stringify(opts.body) : null;
      const r = http.request({
        hostname: '127.0.0.1', port, path, method,
        headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
      }, (res) => {
        let buf = '';
        res.on('data', (c) => buf += c);
        res.on('end', () => {
          server.close();
          try { resolve({ status: res.statusCode || 0, body: buf ? JSON.parse(buf) : null }); }
          catch (e) { resolve({ status: res.statusCode || 0, body: buf }); }
        });
      });
      r.on('error', (e) => { server.close(); reject(e); });
      if (data) r.write(data);
      r.end();
    });
  });
}

let seq = 0;
function uniquePhone(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString().slice(-6)}${seq.toString().padStart(2, '0')}`.slice(0, 14);
}

async function makeVendorWithHotel() {
  const vendor = await prisma.user.create({ data: { phone: uniquePhone('+88017'), passwordHash: 'h', role: 'vendor' } });
  const hotel = await prisma.serviceProvider.create({
    data: {
      userId: vendor.id, category: 'hotel', businessName: `Review Hotel ${vendor.id}`,
      address: 'Addr', city: 'Dhaka', status: 'approved', isVerified: true, isActive: true
    }
  });
  return { vendor, hotel };
}

async function makeCustomerAndBooking(hotelId: number, status = 'completed') {
  const customer = await prisma.user.create({ data: { phone: uniquePhone('+88018'), passwordHash: 'h', role: 'customer' } });
  const booking = await prisma.booking.create({
    data: {
      userId: customer.id, providerId: hotelId, category: 'hotel', status,
      paymentStatus: 'PAID', source: 'ETP', totalAmount: 1000, finalAmount: 1000,
      bookingDate: new Date(), travelDate: new Date(), bookingCode: `BK${customer.id}`
    }
  });
  return { customer, booking };
}

describe('STEP 11 — Hotel reviews + reports', () => {
  let app: express.Express;

  beforeAll(() => { app = createApp(); });

  afterEach(async () => {
    await prisma.review.deleteMany({});
    await prisma.booking.deleteMany({ where: { category: 'hotel' } });
    await prisma.serviceProvider.deleteMany({ where: { category: 'hotel' } });
    await prisma.user.deleteMany({ where: { passwordHash: 'h' } });
  });

  test('POST /hotels/:hotelId/reviews creates review and updates provider rating', async () => {
    const { hotel } = await makeVendorWithHotel();
    const { customer, booking } = await makeCustomerAndBooking(hotel.id);

    const res = await req(app, 'POST', `/api/v1/hotels/${hotel.id}/reviews`, {
      token: signToken({ id: customer.id, phone: customer.phone, role: 'customer' }),
      body: { bookingId: booking.id, rating: 5, comment: 'Excellent stay' }
    });

    expect(res.status).toBe(201);
    expect(res.body.review.rating).toBe(5);

    const updated = await prisma.serviceProvider.findUnique({ where: { id: hotel.id } });
    expect(updated!.totalReviews).toBe(1);
    expect(updated!.rating).toBe(5);
  });

  test('Review is rejected for non-completed/confirmed booking', async () => {
    const { hotel } = await makeVendorWithHotel();
    const { customer, booking } = await makeCustomerAndBooking(hotel.id, 'pending');

    const res = await req(app, 'POST', `/api/v1/hotels/${hotel.id}/reviews`, {
      token: signToken({ id: customer.id, phone: customer.phone, role: 'customer' }),
      body: { bookingId: booking.id, rating: 4 }
    });
    expect(res.status).toBe(400);
  });

  test('Duplicate review for same booking is rejected', async () => {
    const { hotel } = await makeVendorWithHotel();
    const { customer, booking } = await makeCustomerAndBooking(hotel.id);
    const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

    const r1 = await req(app, 'POST', `/api/v1/hotels/${hotel.id}/reviews`, { token, body: { bookingId: booking.id, rating: 5 } });
    const r2 = await req(app, 'POST', `/api/v1/hotels/${hotel.id}/reviews`, { token, body: { bookingId: booking.id, rating: 3 } });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(409);
  });

  test('Review only allowed for booking owner', async () => {
    const { hotel } = await makeVendorWithHotel();
    const { booking } = await makeCustomerAndBooking(hotel.id);
    const other = await prisma.user.create({ data: { phone: uniquePhone('+88019'), passwordHash: 'h', role: 'customer' } });

    const res = await req(app, 'POST', `/api/v1/hotels/${hotel.id}/reviews`, {
      token: signToken({ id: other.id, phone: other.phone, role: 'customer' }),
      body: { bookingId: booking.id, rating: 5 }
    });
    expect(res.status).toBe(403);
  });

  test('Vendor cannot post review (role check)', async () => {
    const { hotel, vendor } = await makeVendorWithHotel();
    const { booking } = await makeCustomerAndBooking(hotel.id);

    const res = await req(app, 'POST', `/api/v1/hotels/${hotel.id}/reviews`, {
      token: signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' }),
      body: { bookingId: booking.id, rating: 5 }
    });
    expect(res.status).toBe(403);
  });

  test('GET /hotels/reports/summary aggregates bookings and computes commission (0% for DIRECT)', async () => {
    const { vendor, hotel } = await makeVendorWithHotel();
    const c1 = await prisma.user.create({ data: { phone: uniquePhone('+88020'), passwordHash: 'h', role: 'customer' } });
    const c2 = await prisma.user.create({ data: { phone: uniquePhone('+88021'), passwordHash: 'h', role: 'customer' } });
    await prisma.booking.create({ data: { userId: c1.id, providerId: hotel.id, category: 'hotel', status: 'confirmed', paymentStatus: 'paid', source: 'ETP', totalAmount: 1000, finalAmount: 1000, bookingDate: new Date(), travelDate: new Date(), bookingCode: 'A' + c1.id } });
    await prisma.booking.create({ data: { userId: c2.id, providerId: hotel.id, category: 'hotel', status: 'confirmed', paymentStatus: 'paid', source: 'DIRECT', totalAmount: 500, finalAmount: 500, bookingDate: new Date(), travelDate: new Date(), bookingCode: 'B' + c2.id } });
    await prisma.booking.create({ data: { userId: c1.id, providerId: hotel.id, category: 'hotel', status: 'cancelled', paymentStatus: 'pending', source: 'ETP', totalAmount: 200, finalAmount: 200, bookingDate: new Date(), travelDate: new Date(), bookingCode: 'C' + c1.id } });

    const res = await req(app, 'GET', '/api/v1/hotels/reports/summary', {
      token: signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' })
    });

    expect(res.status).toBe(200);
    expect(res.body.totals.bookings).toBe(3);
    expect(res.body.totals.gross).toBe(1500);
    expect(res.body.totals.commission).toBe(100);
    expect(res.body.totals.net).toBe(1400);
    const row = res.body.byHotel.find((r: any) => r.id === hotel.id);
    expect(row).toBeDefined();
    expect(row.gross).toBe(1500);
  });

  test('Report respects vendor ownership (cannot see other vendors)', async () => {
    const a = await makeVendorWithHotel();
    const b = await makeVendorWithHotel();

    const res = await req(app, 'GET', '/api/v1/hotels/reports/summary', {
      token: signToken({ id: a.vendor.id, phone: a.vendor.phone, role: 'vendor' })
    });
    expect(res.status).toBe(200);
    const ids = res.body.byHotel.map((r: any) => r.id);
    expect(ids).toContain(a.hotel.id);
    expect(ids).not.toContain(b.hotel.id);
  });
});
