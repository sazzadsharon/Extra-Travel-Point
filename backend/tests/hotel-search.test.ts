import express from 'express';
import http from 'http';
import { prisma } from '../src/prisma';
import hotelRoutes from '../src/routes/hotel.routes';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hotels', hotelRoutes);
  app.use('/api/v1/hotels', hotelManageRoutes);
  return app;
}

function request_(app: express.Express, method: string, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as { port: number };
      const url = `http://127.0.0.1:${port}${path}`;
      const req = http.request(url, { method, headers: { 'Content-Type': 'application/json' } }, res => {
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

async function seedApprovedHotel(opts: { city: string; starRating?: number; amenities?: string[]; rating?: number }) {
  const v = await prisma.user.create({
    data: { phone: '019' + Math.floor(Math.random() * 1e9).toString().padStart(9, '0'), passwordHash: 'h', role: 'vendor' }
  });
  const h = await prisma.serviceProvider.create({
    data: {
      userId: v.id,
      businessName: 'Test ' + opts.city,
      category: 'hotel',
      address: '1 St',
      city: opts.city,
      starRating: opts.starRating ?? 3,
      rating: opts.rating ?? 4.0,
      status: 'APPROVED',
      isVerified: true,
      isActive: true,
      isPublished: true,
      lifecycleStatus: 'APPROVED'
    }
  });
  await prisma.room.create({
    data: {
      providerId: h.id,
      name: 'Standard',
      type: 'STD',
      price: 2500,
      capacity: 2,
      adultCapacity: 2,
      childCapacity: 0,
      totalRooms: 5,
      isAvailable: true,
      baseCurrency: 'BDT',
      status: 'ACTIVE'
    }
  });
  if (opts.amenities && opts.amenities.length > 0) {
    await prisma.hotelAmenity.createMany({
      data: opts.amenities.map(name => ({ providerId: h.id, name }))
    });
  }
  return h;
}

describe('STEP 5 — Hotel Search, Filtering & Discovery', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await cleanup();
  });

  it('returns paginated hotels sorted by price', async () => {
    await seedApprovedHotel({ city: 'Cox' });
    await seedApprovedHotel({ city: 'Dhaka' });
    const app = createApp();
    const res = await request_(app, 'GET', '/api/v1/hotels/search?sort=price_asc&page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(2);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('filters hotels by city', async () => {
    await seedApprovedHotel({ city: 'Cox' });
    await seedApprovedHotel({ city: 'Dhaka' });
    const app = createApp();
    const res = await request_(app, 'GET', '/api/v1/hotels/search?city=Cox');
    expect(res.status).toBe(200);
    expect(res.body.hotels.every((h: any) => h.city === 'Cox')).toBe(true);
  });

  it('filters hotels by star rating', async () => {
    await seedApprovedHotel({ city: 'A', starRating: 2 });
    await seedApprovedHotel({ city: 'B', starRating: 5 });
    const app = createApp();
    const res = await request_(app, 'GET', '/api/v1/hotels/search?starRating=4');
    expect(res.status).toBe(200);
    expect(res.body.hotels.every((h: any) => (h.starRating || 0) >= 4)).toBe(true);
  });

  it('filters hotels by amenities', async () => {
    await seedApprovedHotel({ city: 'A', amenities: ['WiFi', 'Pool'] });
    await seedApprovedHotel({ city: 'B', amenities: ['WiFi'] });
    const app = createApp();
    const res = await request_(app, 'GET', '/api/v1/hotels/search?amenities=WiFi,Pool');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.hotels[0].city).toBe('A');
  });

  it('filters hotels by guest capacity', async () => {
    await seedApprovedHotel({ city: 'A' }); // capacity 2
    const app = createApp();
    const res = await request_(app, 'GET', '/api/v1/hotels/search?guests=4');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it('lists distinct cities', async () => {
    await seedApprovedHotel({ city: 'A' });
    await seedApprovedHotel({ city: 'B' });
    const app = createApp();
    const res = await request_(app, 'GET', '/api/v1/hotels/cities');
    expect(res.status).toBe(200);
    expect(res.body.cities).toContain('A');
    expect(res.body.cities).toContain('B');
  });

  it('returns featured hotels via /discover', async () => {
    await seedApprovedHotel({ city: 'A', rating: 4.5 });
    await seedApprovedHotel({ city: 'B', rating: 2.0 });
    const app = createApp();
    const res = await request_(app, 'GET', '/api/v1/hotels/discover?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.hotels.length).toBeGreaterThanOrEqual(1);
    // only high-rating should be returned
    expect(res.body.hotels.every((h: any) => (h.rating || 0) >= 3)).toBe(true);
  });

  it('public hotel details does not leak unpublished hotels', async () => {
    const v = await prisma.user.create({
      data: { phone: '019' + Math.floor(Math.random() * 1e9).toString().padStart(9, '0'), passwordHash: 'h', role: 'vendor' }
    });
    const unpublished = await prisma.serviceProvider.create({
      data: {
        userId: v.id,
        businessName: 'Secret',
        category: 'hotel',
        address: 'x',
        city: 'X',
        status: 'PENDING',
        isVerified: false,
        isActive: false,
        isPublished: false,
        lifecycleStatus: 'DRAFT'
      }
    });
    const app = createApp();
    const res = await request_(app, 'GET', `/api/v1/hotels/details/${unpublished.id}`);
    expect(res.status).toBe(404);
  });
});
