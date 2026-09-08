import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';

function signToken(payload: { id: number; phone: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test', { expiresIn: '2h' });
}
function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hotels', hotelManageRoutes);
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
  await prisma.hotelTax.deleteMany();
  await prisma.hotelPromotion.deleteMany();
  await prisma.hotelPolicy.deleteMany();
  await prisma.hotelAmenity.deleteMany();
  await prisma.hotelImage.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.hotelAvailability.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.room.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.hotelMaintenanceRequest.deleteMany();
  await prisma.hotelStaff.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

describe('STEP 7 — Hotel Pricing with Taxes & Promotions', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => {
    await prisma.hotelTax.deleteMany();
    await prisma.hotelPromotion.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.payoutRequest.deleteMany();
    await prisma.qrLog.deleteMany();
    await prisma.review.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.seatLock.deleteMany();
    await prisma.hotelAvailability.deleteMany();
    await prisma.ratePlan.deleteMany();
    await prisma.hotelImage.deleteMany();
    await prisma.hotelAmenity.deleteMany();
    await prisma.hotelPolicy.deleteMany();
    await prisma.housekeepingTask.deleteMany();
    await prisma.hotelMaintenanceRequest.deleteMany();
    await prisma.hotelStaff.deleteMany();
    await prisma.room.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  async function setupWorld() {
    const v = await prisma.user.create({ data: { phone: '01911100001', passwordHash: 'h', role: 'vendor' } });
    const h = await prisma.serviceProvider.create({
      data: {
        userId: v.id, businessName: 'H', category: 'hotel', address: '1', city: 'D',
        status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
      }
    });
    const room = await prisma.room.create({
      data: {
        providerId: h.id, name: 'STD', type: 'STD', price: 2000,
        capacity: 2, adultCapacity: 2, childCapacity: 0, totalRooms: 5,
        isAvailable: true, baseCurrency: 'BDT', status: 'ACTIVE'
      }
    });
    return { v, h, room };
  }

  it('quote includes hotel tax percentage', async () => {
    const { h, room } = await setupWorld();
    await prisma.hotelTax.create({
      data: { providerId: h.id, name: 'VAT', type: 'percentage', value: 5, isActive: true }
    });
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 2);
    const res = await request_(app, 'POST', '/api/v1/hotels/quote', {
      body: { roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString() }
    });
    // eslint-disable-next-line no-console
    console.log('STATUS:', res.status, 'BODY:', JSON.stringify(res.body));
    expect(res.status).toBe(200);
    expect(res.body.taxesApplied).toBe(1);
    expect(res.body.breakdown.baseAmount).toBe(4000);
    expect(res.body.breakdown.taxAmount).toBe(200); // 5% of 4000
    expect(res.body.breakdown.finalAmount).toBe(4200);
  });

  it('quote includes hotel tax fixed amount', async () => {
    const { h, room } = await setupWorld();
    await prisma.hotelTax.create({
      data: { providerId: h.id, name: 'Service', type: 'fixed', value: 100, isActive: true }
    });
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
    const res = await request_(app, 'POST', '/api/v1/hotels/quote', {
      body: { roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString() }
    });
    expect(res.status).toBe(200);
    expect(res.body.breakdown.serviceFee).toBe(100);
  });

  it('quote multiplies by numberOfRooms', async () => {
    const { room } = await setupWorld();
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
    const res = await request_(app, 'POST', '/api/v1/hotels/quote', {
      body: { roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), numberOfRooms: 3 }
    });
    expect(res.status).toBe(200);
    expect(res.body.breakdown.baseAmount).toBe(6000); // 2000 * 1 night * 3 rooms
    expect(res.body.breakdown.finalAmount).toBe(6000);
  });

  it('quote applies promotion', async () => {
    const { h, room } = await setupWorld();
    await prisma.hotelPromotion.create({
      data: {
        providerId: h.id, code: 'SAVE', name: 'Save 15',
        discountType: 'percentage', discountValue: 15,
        minNights: 1, minAmount: 0,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000),
        isActive: true
      }
    });
    const app = createApp();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 2);
    const res = await request_(app, 'POST', '/api/v1/hotels/quote', {
      body: { roomId: room.id, checkIn: tomorrow.toISOString(), checkOut: dayAfter.toISOString(), promoCode: 'SAVE' }
    });
    expect(res.status).toBe(200);
    expect(res.body.breakdown.discountAmount).toBe(600); // 15% of 4000
    expect(res.body.breakdown.finalAmount).toBe(3400);
  });

  it('vendor adds and removes hotel taxes', async () => {
    const { v, h } = await setupWorld();
    const token = signToken({ id: v.id, phone: v.phone, role: 'vendor' });
    const app = createApp();
    const add = await request_(app, 'POST', `/api/v1/hotels/manage/${h.id}/taxes`, {
      token,
      body: [{ name: 'VAT', type: 'percentage', value: 5 }]
    });
    expect(add.status).toBe(201);
    const taxId = add.body.taxes[0].id;
    const del = await request_(app, 'DELETE', `/api/v1/hotels/manage/${h.id}/taxes/${taxId}`, { token });
    expect(del.status).toBe(200);
    const remaining = await prisma.hotelTax.count({ where: { providerId: h.id } });
    expect(remaining).toBe(0);
  });
});
