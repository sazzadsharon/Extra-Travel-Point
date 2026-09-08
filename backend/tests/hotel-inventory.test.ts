import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';

import hotelRoutes from '../src/routes/hotel.routes';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';
import hotelRoomRoutes from '../src/routes/hotel-room.routes';

function signToken(payload: { id: number; phone: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test', { expiresIn: '2h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hotels', hotelRoutes);
  app.use('/api/v1/hotels', hotelManageRoutes);
  app.use('/api/v1/hotel-rooms', hotelRoomRoutes);
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

async function setupWorld() {
  const vendor = await prisma.user.create({
    data: { phone: '01911100000', passwordHash: 'h', role: 'vendor' }
  });
  const hotel = await prisma.serviceProvider.create({
    data: {
      userId: vendor.id,
      businessName: 'Test Hotel',
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
      name: 'Standard',
      type: 'STD',
      price: 2000,
      capacity: 2,
      adultCapacity: 2,
      childCapacity: 0,
      totalRooms: 2,
      isAvailable: true,
      baseCurrency: 'BDT',
      status: 'ACTIVE'
    }
  });
  return { vendor, hotel, room };
}

describe('STEP 4 — Room Type, Inventory & Availability', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
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
  });

  describe('Vendor creates and updates rooms', () => {
    it('creates a room under an owned hotel', async () => {
      const { vendor, hotel } = await setupWorld();
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'POST', '/api/v1/hotel-rooms', {
        token,
        body: {
          hotelId: hotel.id,
          name: 'Deluxe',
          type: 'DLX',
          price: 5000,
          capacity: 4,
          adultCapacity: 2,
          childCapacity: 2,
          totalRooms: 5,
          roomNumber: 'D-101',
          bedConfig: '1 King + 1 Sofa'
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.room.name).toBe('Deluxe');
      expect(res.body.room.totalRooms).toBe(5);
      expect(res.body.room.status).toBe('ACTIVE');
    });

    it('rejects room creation for hotel not owned', async () => {
      const { hotel } = await setupWorld();
      const other = await prisma.user.create({
        data: { phone: '01911100099', passwordHash: 'h', role: 'vendor' }
      });
      const app = createApp();
      const token = signToken({ id: other.id, phone: other.phone, role: 'vendor' });
      const res = await request_(app, 'POST', '/api/v1/hotel-rooms', {
        token,
        body: { hotelId: hotel.id, name: 'XX', type: 'X', price: 1000, totalRooms: 1 }
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Maintenance / Out-of-Service status', () => {
    it('blocks next 30 days availability when room set to MAINTENANCE', async () => {
      const { vendor, room } = await setupWorld();
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'POST', `/api/v1/hotel-rooms/${room.id}/status`, {
        token,
        body: { status: 'MAINTENANCE', notes: 'AC repair' }
      });
      expect(res.status).toBe(200);
      expect(res.body.room.status).toBe('MAINTENANCE');
      expect(res.body.room.isAvailable).toBe(false);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const blocked = await prisma.hotelAvailability.findMany({
        where: { roomId: room.id, date: { gte: today }, isActive: false }
      });
      expect(blocked.length).toBeGreaterThanOrEqual(1);

      const req = await prisma.hotelMaintenanceRequest.findFirst({ where: { roomId: room.id } });
      expect(req).not.toBeNull();
    });
  });

  describe('Public listing', () => {
    it('lists active rooms for a hotel', async () => {
      const { hotel } = await setupWorld();
      const app = createApp();
      const res = await request_(app, 'GET', `/api/v1/hotel-rooms?hotelId=${hotel.id}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body.rooms[0].status).toBe('ACTIVE');
    });
  });
});
