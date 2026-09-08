import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';

import hotelRoutes from '../src/routes/hotel.routes';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';

function signToken(payload: { id: number; phone: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test', { expiresIn: '2h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hotels', hotelRoutes);
  app.use('/api/v1/hotels', hotelManageRoutes);
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
}

describe('STEP 3 — Hotel Provider Onboarding & Management', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await cleanup(); });

  // =====================================================================
  // 3.1 HOTEL PROVIDER OWNERSHIP & 3.4 HOTEL CREATION API
  // =====================================================================
  describe('Hotel creation and ownership', () => {
    it('provider can create hotel', async () => {
      const user = await prisma.user.create({
        data: { phone: '01910000001', passwordHash: 'h', role: 'vendor', fullName: 'Owner' }
      });
      const app = createApp();
      const token = signToken({ id: user.id, phone: user.phone, role: 'vendor' });
      const res = await request_(app, 'POST', '/api/v1/hotels/manage', {
        token,
        body: {
          businessName: 'My Hotel',
          address: '123 Main St',
          phone: '01700000001'
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.hotel.businessName).toBe('My Hotel');
      expect(res.body.hotel.userId).toBe(user.id);
      expect(res.body.hotel.lifecycleStatus).toBe('DRAFT');
    });

    it('unauthenticated user cannot create hotel', async () => {
      const app = createApp();
      const res = await request_(app, 'POST', '/api/v1/hotels/manage', {
        body: { businessName: 'X', address: 'Y' }
      });
      expect(res.status).toBe(401);
    });

    it('customer cannot create hotel', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01810000001', passwordHash: 'h', role: 'customer', fullName: 'Cust' }
      });
      const app = createApp();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const res = await request_(app, 'POST', '/api/v1/hotels/manage', {
        token,
        body: { businessName: 'X', address: 'Y' }
      });
      expect(res.status).toBe(403);
    });

    it('provider cannot update another provider hotel (IDOR)', async () => {
      const owner = await prisma.user.create({
        data: { phone: '01910000002', passwordHash: 'h', role: 'vendor', fullName: 'Owner' }
      });
      const intruder = await prisma.user.create({
        data: { phone: '01910000003', passwordHash: 'h', role: 'vendor', fullName: 'Intruder' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: owner.id,
          businessName: 'Owner Hotel',
          category: 'hotel',
          address: '1 St',
          status: 'APPROVED',
          isVerified: true,
          isActive: true,
          isPublished: true,
          lifecycleStatus: 'APPROVED'
        }
      });
      const app = createApp();
      const token = signToken({ id: intruder.id, phone: intruder.phone, role: 'vendor' });
      const res = await request_(app, 'PATCH', `/api/v1/hotels/manage/${hotel.id}`, {
        token,
        body: { businessName: 'Hacked' }
      });
      expect(res.status).toBe(403);
    });

    it('provider cannot change hotel ownership', async () => {
      const owner = await prisma.user.create({
        data: { phone: '01910000004', passwordHash: 'h', role: 'vendor', fullName: 'Owner' }
      });
      const newOwner = await prisma.user.create({
        data: { phone: '01910000005', passwordHash: 'h', role: 'vendor', fullName: 'NewOwner' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: owner.id,
          businessName: 'Owner Hotel',
          category: 'hotel',
          address: '1 St',
          status: 'APPROVED',
          isVerified: true,
          isActive: true,
          isPublished: true,
          lifecycleStatus: 'APPROVED'
        }
      });
      const app = createApp();
      const token = signToken({ id: owner.id, phone: owner.phone, role: 'vendor' });
      const res = await request_(app, 'PATCH', `/api/v1/hotels/manage/${hotel.id}`, {
        token,
        body: { userId: newOwner.id }
      });
      expect(res.status).toBe(200);
      const updated = await prisma.serviceProvider.findUnique({ where: { id: hotel.id } });
      expect(updated?.userId).toBe(owner.id);
    });
  });

  // =====================================================================
  // 3.6 HOTEL READ APIs & 3.7 HOTEL LISTING
  // =====================================================================
  describe('Provider hotel listing and access', () => {
    it('provider can view own hotels', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000006', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Hotel A',
          category: 'hotel',
          address: '1 St',
          status: 'APPROVED',
          isVerified: true,
          isActive: true,
          isPublished: true,
          lifecycleStatus: 'APPROVED'
        }
      });
      await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Hotel B',
          category: 'hotel',
          address: '2 St',
          status: 'DRAFT',
          isVerified: false,
          isActive: false,
          isPublished: false,
          lifecycleStatus: 'DRAFT'
        }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'GET', '/api/v1/hotels/my', { token });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.hotels.map((h: any) => h.businessName).sort()).toEqual(['Hotel A', 'Hotel B']);
    });

    it('provider cannot access another provider private hotel data via manage/:id', async () => {
      const owner = await prisma.user.create({
        data: { phone: '01910000007', passwordHash: 'h', role: 'vendor', fullName: 'Owner' }
      });
      const intruder = await prisma.user.create({
        data: { phone: '01910000008', passwordHash: 'h', role: 'vendor', fullName: 'Intruder' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: owner.id,
          businessName: 'Private Hotel',
          category: 'hotel',
          address: '1 St',
          status: 'APPROVED',
          isVerified: true,
          isActive: true,
          isPublished: true,
          lifecycleStatus: 'APPROVED'
        }
      });
      const app = createApp();
      const token = signToken({ id: intruder.id, phone: intruder.phone, role: 'vendor' });
      const res = await request_(app, 'GET', `/api/v1/hotels/manage/${hotel.id}`, { token });
      expect(res.status).toBe(403);
    });
  });

  // =====================================================================
  // 3.12 HOTEL SUBMISSION & 3.13 ADMIN APPROVAL
  // =====================================================================
  describe('Hotel submission and admin approval', () => {
    it('provider can submit own hotel for approval', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000009', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Submit Hotel',
          category: 'hotel',
          address: '1 St',
          phone: '01700000001',
          status: 'PENDING',
          lifecycleStatus: 'DRAFT',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      await prisma.room.create({
        data: {
          providerId: hotel.id,
          name: 'Std',
          type: 'STD',
          price: 1000,
          capacity: 2,
          isAvailable: true,
          baseCurrency: 'BDT',
          status: 'ACTIVE'
        }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'POST', `/api/v1/hotels/manage/${hotel.id}/submit`, { token });
      expect(res.status).toBe(200);
      expect(res.body.hotel.lifecycleStatus).toBe('PENDING_APPROVAL');
      expect(res.body.hotel.status).toBe('PENDING');
    });

    it('validation rejects incomplete hotel submission', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000010', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: '',
          category: 'hotel',
          address: '',
          phone: '',
          status: 'PENDING',
          lifecycleStatus: 'DRAFT',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'POST', `/api/v1/hotels/manage/${hotel.id}/submit`, { token });
      expect(res.status).toBe(400);
      expect(res.body.details).toBeDefined();
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('provider cannot approve own hotel', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000011', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Self Approve Test',
          category: 'hotel',
          address: '1 St',
          status: 'PENDING',
          lifecycleStatus: 'PENDING_APPROVAL',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'POST', `/api/v1/hotels/admin/${hotel.id}/approve`, { token });
      expect(res.status).toBe(403);
    });

    it('admin can approve hotel', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000012', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      const admin = await prisma.user.create({
        data: { phone: '01710000001', passwordHash: 'h', role: 'admin', fullName: 'Admin' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Approve Me',
          category: 'hotel',
          address: '1 St',
          status: 'PENDING',
          lifecycleStatus: 'PENDING_APPROVAL',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      const app = createApp();
      const token = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });
      const res = await request_(app, 'POST', `/api/v1/hotels/admin/${hotel.id}/approve`, { token });
      expect(res.status).toBe(200);
      expect(res.body.hotel.status).toBe('APPROVED');
      expect(res.body.hotel.lifecycleStatus).toBe('APPROVED');
      expect(res.body.hotel.isVerified).toBe(true);
      expect(res.body.hotel.isActive).toBe(true);
    });

    it('admin can reject hotel with reason', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000013', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      const admin = await prisma.user.create({
        data: { phone: '01710000002', passwordHash: 'h', role: 'admin', fullName: 'Admin' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Reject Me',
          category: 'hotel',
          address: '1 St',
          status: 'PENDING',
          lifecycleStatus: 'PENDING_APPROVAL',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      const app = createApp();
      const token = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });
      const res = await request_(app, 'POST', `/api/v1/hotels/admin/${hotel.id}/reject`, {
        token,
        body: { reason: 'Incomplete info' }
      });
      expect(res.status).toBe(200);
      expect(res.body.hotel.status).toBe('REJECTED');
      expect(res.body.hotel.lifecycleStatus).toBe('REJECTED');
      expect(res.body.hotel.rejectionReason).toBe('Incomplete info');
    });

    it('admin can suspend hotel', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000014', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      const admin = await prisma.user.create({
        data: { phone: '01710000003', passwordHash: 'h', role: 'admin', fullName: 'Admin' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Suspend Me',
          category: 'hotel',
          address: '1 St',
          status: 'APPROVED',
          isVerified: true,
          isActive: true,
          isPublished: true,
          lifecycleStatus: 'APPROVED'
        }
      });
      const app = createApp();
      const token = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });
      const res = await request_(app, 'POST', `/api/v1/hotels/admin/${hotel.id}/suspend`, {
        token,
        body: { reason: 'Policy violation' }
      });
      expect(res.status).toBe(200);
      expect(res.body.hotel.status).toBe('SUSPENDED');
      expect(res.body.hotel.lifecycleStatus).toBe('SUSPENDED');
      expect(res.body.hotel.isActive).toBe(false);
      expect(res.body.hotel.isPublished).toBe(false);
    });

    it('admin can reactivate suspended/rejected hotel', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000015', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      const admin = await prisma.user.create({
        data: { phone: '01710000004', passwordHash: 'h', role: 'admin', fullName: 'Admin' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Reactivate Me',
          category: 'hotel',
          address: '1 St',
          status: 'REJECTED',
          lifecycleStatus: 'REJECTED',
          isVerified: false,
          isActive: false,
          isPublished: false,
          rejectionReason: 'Bad data'
        }
      });
      const app = createApp();
      const token = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });
      const res = await request_(app, 'POST', `/api/v1/hotels/admin/${hotel.id}/reactivate`, { token });
      expect(res.status).toBe(200);
      expect(res.body.hotel.lifecycleStatus).toBe('DRAFT');
      expect(res.body.hotel.status).toBe('PENDING');
      expect(res.body.hotel.rejectionReason).toBeNull();
    });
  });

  // =====================================================================
  // 3.14 PUBLIC VISIBILITY RULES
  // =====================================================================
  describe('Public visibility by lifecycle status', () => {
    it('approved hotel is publicly discoverable', async () => {
      const v = await prisma.user.create({
        data: { phone: '01910000016', passwordHash: 'h', role: 'vendor', fullName: 'V' }
      });
      await prisma.serviceProvider.create({
        data: {
          userId: v.id,
          businessName: 'Public Hotel',
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
      const app = createApp();
      const res = await request_(app, 'GET', '/api/v1/hotels/search?city=Dhaka');
      expect(res.status).toBe(200);
      expect(res.body.hotels.some((h: any) => h.businessName === 'Public Hotel')).toBe(true);
    });

    it('draft hotel is NOT publicly discoverable', async () => {
      const v = await prisma.user.create({
        data: { phone: '01910000017', passwordHash: 'h', role: 'vendor', fullName: 'V' }
      });
      const draft = await prisma.serviceProvider.create({
        data: {
          userId: v.id,
          businessName: 'Draft Hotel',
          category: 'hotel',
          address: '1 St',
          city: 'Dhaka',
          status: 'PENDING',
          lifecycleStatus: 'DRAFT',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      const app = createApp();
      const res = await request_(app, 'GET', '/api/v1/hotels/search');
      expect(res.status).toBe(200);
      expect(res.body.hotels.some((h: any) => h.id === draft.id)).toBe(false);
    });

    it('pending hotel is NOT publicly discoverable', async () => {
      const v = await prisma.user.create({
        data: { phone: '01910000018', passwordHash: 'h', role: 'vendor', fullName: 'V' }
      });
      const pending = await prisma.serviceProvider.create({
        data: {
          userId: v.id,
          businessName: 'Pending Hotel',
          category: 'hotel',
          address: '1 St',
          city: 'Dhaka',
          status: 'PENDING',
          lifecycleStatus: 'PENDING_APPROVAL',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      const app = createApp();
      const res = await request_(app, 'GET', '/api/v1/hotels/search');
      expect(res.status).toBe(200);
      expect(res.body.hotels.some((h: any) => h.id === pending.id)).toBe(false);
    });

    it('rejected hotel is NOT publicly discoverable', async () => {
      const v = await prisma.user.create({
        data: { phone: '01910000019', passwordHash: 'h', role: 'vendor', fullName: 'V' }
      });
      const rejected = await prisma.serviceProvider.create({
        data: {
          userId: v.id,
          businessName: 'Rejected Hotel',
          category: 'hotel',
          address: '1 St',
          city: 'Dhaka',
          status: 'REJECTED',
          lifecycleStatus: 'REJECTED',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      const app = createApp();
      const res = await request_(app, 'GET', '/api/v1/hotels/search');
      expect(res.status).toBe(200);
      expect(res.body.hotels.some((h: any) => h.id === rejected.id)).toBe(false);
    });

    it('suspended hotel is NOT publicly discoverable', async () => {
      const v = await prisma.user.create({
        data: { phone: '01910000020', passwordHash: 'h', role: 'vendor', fullName: 'V' }
      });
      const suspended = await prisma.serviceProvider.create({
        data: {
          userId: v.id,
          businessName: 'Suspended Hotel',
          category: 'hotel',
          address: '1 St',
          city: 'Dhaka',
          status: 'SUSPENDED',
          lifecycleStatus: 'SUSPENDED',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      const app = createApp();
      const res = await request_(app, 'GET', '/api/v1/hotels/search');
      expect(res.status).toBe(200);
      expect(res.body.hotels.some((h: any) => h.id === suspended.id)).toBe(false);
    });

    it('inactive hotel is NOT publicly discoverable', async () => {
      const v = await prisma.user.create({
        data: { phone: '01910000021', passwordHash: 'h', role: 'vendor', fullName: 'V' }
      });
      const inactive = await prisma.serviceProvider.create({
        data: {
          userId: v.id,
          businessName: 'Inactive Hotel',
          category: 'hotel',
          address: '1 St',
          city: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: false,
          isPublished: false,
          lifecycleStatus: 'INACTIVE'
        }
      });
      const app = createApp();
      const res = await request_(app, 'GET', '/api/v1/hotels/search');
      expect(res.status).toBe(200);
      expect(res.body.hotels.some((h: any) => h.id === inactive.id)).toBe(false);
    });
  });

  // =====================================================================
  // 3.18 SECURITY — IDOR & PRIVATE DATA LEAK
  // =====================================================================
  describe('Security: IDOR and data isolation', () => {
    it('GET /hotels/details/:id returns 404 for non-approved hotel', async () => {
      const v = await prisma.user.create({
        data: { phone: '01910000022', passwordHash: 'h', role: 'vendor', fullName: 'V' }
      });
      const draft = await prisma.serviceProvider.create({
        data: {
          userId: v.id,
          businessName: 'Secret Draft',
          category: 'hotel',
          address: '1 St',
          status: 'PENDING',
          lifecycleStatus: 'DRAFT',
          isVerified: false,
          isActive: false,
          isPublished: false
        }
      });
      const app = createApp();
      const res = await request_(app, 'GET', `/api/v1/hotels/details/${draft.id}`);
      expect(res.status).toBe(404);
    });

    it('provider cannot access another provider private hotel via manage/:id', async () => {
      const owner = await prisma.user.create({
        data: { phone: '01910000023', passwordHash: 'h', role: 'vendor', fullName: 'Owner' }
      });
      const intruder = await prisma.user.create({
        data: { phone: '01910000024', passwordHash: 'h', role: 'vendor', fullName: 'Intruder' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: owner.id,
          businessName: 'Private Hotel',
          category: 'hotel',
          address: '1 St',
          status: 'APPROVED',
          isVerified: true,
          isActive: true,
          isPublished: true,
          lifecycleStatus: 'APPROVED'
        }
      });
      const app = createApp();
      const token = signToken({ id: intruder.id, phone: intruder.phone, role: 'vendor' });
      const res = await request_(app, 'GET', `/api/v1/hotels/manage/${hotel.id}`, { token });
      expect(res.status).toBe(403);
    });

    it('public details does not leak private provider data', async () => {
      const v = await prisma.user.create({
        data: { phone: '01910000025', passwordHash: 'h', role: 'vendor', fullName: 'V', email: 'secret@test.com' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: v.id,
          businessName: 'Public Hotel',
          category: 'hotel',
          address: '1 St',
          city: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true,
          isPublished: true,
          lifecycleStatus: 'APPROVED',
          commissionRate: 15.5,
          kycData: JSON.stringify({ secret: 'data' }),
          rejectionReason: 'old reason'
        }
      });
      const app = createApp();
      const res = await request_(app, 'GET', `/api/v1/hotels/details/${hotel.id}`);
      expect(res.status).toBe(200);
      expect(res.body.commissionRate).toBeUndefined();
      expect(res.body.kycData).toBeUndefined();
      expect(res.body.rejectionReason).toBeUndefined();
      expect(res.body.user).toBeUndefined();
    });
  });

  // =====================================================================
  // 3.23 SIMPLE LOCAL HOTEL UX & 3.24 LARGE HOTEL UX
  // =====================================================================
  describe('Onboarding modes', () => {
    it('supports SIMPLE onboarding mode', async () => {
      const user = await prisma.user.create({
        data: { phone: '01910000026', passwordHash: 'h', role: 'vendor', fullName: 'Owner' }
      });
      const app = createApp();
      const token = signToken({ id: user.id, phone: user.phone, role: 'vendor' });
      const res = await request_(app, 'POST', '/api/v1/hotels/manage', {
        token,
        body: {
          businessName: 'Simple Guest House',
          address: '123 Local Rd',
          phone: '01700000002',
          onboardingMode: 'SIMPLE'
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.hotel.onboardingMode).toBe('SIMPLE');
    });

    it('supports ADVANCED onboarding mode', async () => {
      const user = await prisma.user.create({
        data: { phone: '01910000027', passwordHash: 'h', role: 'vendor', fullName: 'Owner' }
      });
      const app = createApp();
      const token = signToken({ id: user.id, phone: user.phone, role: 'vendor' });
      const res = await request_(app, 'POST', '/api/v1/hotels/manage', {
        token,
        body: {
          businessName: 'Grand Resort',
          address: '456 Beach Rd',
          phone: '01700000003',
          description: 'Luxury resort',
          onboardingMode: 'ADVANCED'
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.hotel.onboardingMode).toBe('ADVANCED');
      expect(res.body.hotel.description).toBe('Luxury resort');
    });
  });

  // =====================================================================
  // 3.15 HOTEL EDITING AFTER APPROVAL
  // =====================================================================
  describe('Editing after approval', () => {
    it('provider can update approved hotel profile', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000028', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Old Name',
          category: 'hotel',
          address: '1 St',
          status: 'APPROVED',
          isVerified: true,
          isActive: true,
          isPublished: true,
          lifecycleStatus: 'APPROVED'
        }
      });
      const app = createApp();
      const token = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });
      const res = await request_(app, 'PATCH', `/api/v1/hotels/manage/${hotel.id}`, {
        token,
        body: { businessName: 'New Name', description: 'Updated desc' }
      });
      expect(res.status).toBe(200);
      expect(res.body.hotel.businessName).toBe('New Name');
      expect(res.body.hotel.description).toBe('Updated desc');
    });
  });

  // =====================================================================
  // 3.16 HOTEL SUSPENSION IMPACT
  // =====================================================================
  describe('Suspension behavior', () => {
    it('suspended hotel cannot be booked', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01910000029', passwordHash: 'h', role: 'vendor', fullName: 'Vendor' }
      });
      const customer = await prisma.user.create({
        data: { phone: '01810000002', passwordHash: 'h', role: 'customer', fullName: 'Cust' }
      });
      const hotel = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Suspend Hotel',
          category: 'hotel',
          address: '1 St',
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
          name: 'Std',
          type: 'STD',
          price: 1000,
          capacity: 2,
          isAvailable: true,
          baseCurrency: 'BDT',
          status: 'ACTIVE'
        }
      });
      const admin = await prisma.user.create({
        data: { phone: '01710000005', passwordHash: 'h', role: 'admin', fullName: 'Admin' }
      });
      const app = createApp();
      const adminToken = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });
      await request_(app, 'POST', `/api/v1/hotels/admin/${hotel.id}/suspend`, {
        token: adminToken,
        body: { reason: 'Violation' }
      });
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const res = await request_(app, 'POST', '/api/v1/hotels/book', {
        token: custToken,
        body: {
          hotelId: hotel.id,
          roomId: room.id,
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-16',
          numberOfGuests: 1,
          customerInfo: { name: 'Customer', email: 'c@t.com', phone: '01800000001' }
        }
      });
      expect(res.status).toBe(404);
    });
  });
});
