import { PrismaClient } from '@prisma/client';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import vendorRoutes from '../src/routes/vendor.routes';
import vendorServiceRoutes from '../src/routes/vendor-service.routes';

const prisma = new PrismaClient();

jest.setTimeout(20000);

function signToken(user: { id: number; phone: string; role: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(user, secret, { expiresIn: '1h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/vendors', vendorRoutes);
  app.use('/api/v1/vendors', vendorServiceRoutes);
  app.use('/api/v1', vendorServiceRoutes);
  return app;
}

function request(
  app: express.Express,
  method: string,
  path: string,
  opts: { token?: string; body?: any } = {}
) {
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

async function setupWorld() {
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

  const vendorAUser = await prisma.user.create({
    data: { phone: '01911000011', passwordHash: 'hash', role: 'vendor', fullName: 'Vendor A Owner' }
  });
  const vendorA = await prisma.serviceProvider.create({
    data: {
      userId: vendorAUser.id,
      businessName: 'Vendor A Tours',
      category: 'tour',
      address: 'Gulshan, Dhaka',
      city: 'Dhaka',
      status: 'APPROVED',
      isVerified: true,
      isActive: true
    }
  });

  const vendorBUser = await prisma.user.create({
    data: { phone: '01911000012', passwordHash: 'hash', role: 'vendor', fullName: 'Vendor B Owner' }
  });
  const vendorB = await prisma.serviceProvider.create({
    data: {
      userId: vendorBUser.id,
      businessName: 'Vendor B Hotels',
      category: 'hotel',
      address: 'Cox\'s Bazar',
      city: 'Cox\'s Bazar',
      status: 'APPROVED',
      isVerified: true,
      isActive: true
    }
  });

  const pendingUser = await prisma.user.create({
    data: { phone: '01911000013', passwordHash: 'hash', role: 'vendor', fullName: 'Pending Vendor' }
  });
  const pendingProvider = await prisma.serviceProvider.create({
    data: {
      userId: pendingUser.id,
      businessName: 'Pending Vendor',
      category: 'bus',
      address: 'Banani',
      city: 'Dhaka',
      status: 'PENDING',
      isActive: false
    }
  });

  const customer = await prisma.user.create({
    data: { phone: '01811000011', passwordHash: 'hash', role: 'customer', fullName: 'Customer' }
  });

  const adminUser = await prisma.user.create({
    data: { phone: '01700000000', passwordHash: 'hash', role: 'admin', fullName: 'Admin' }
  });

  return { vendorAUser, vendorA, vendorBUser, vendorB, pendingUser, pendingProvider, customer, adminUser };
}

describe('Vendor Service Management', () => {
  const app = createApp();

  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
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

  it('1. approved vendor can create a service', async () => {
    const { vendorAUser } = await setupWorld();
    const token = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const res = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: {
        name: 'Sundarbans Day Tour',
        serviceType: 'TOUR',
        description: 'Full-day Sundarbans guided tour',
        price: 4500,
        currency: 'BDT',
        locationCity: 'Khulna',
        locationAddress: 'Sundarbans gateway',
        capacity: 12,
        availableDays: [0, 2, 4, 6]
      }
    });
    expect(res.status).toBe(201);
    expect(res.body.service.name).toBe('Sundarbans Day Tour');
    expect(res.body.service.serviceType).toBe('TOUR');
    expect(res.body.service.lifecycleStatus).toBe('DRAFT');
    expect(res.body.service.providerId).toBeGreaterThan(0);
    expect(res.body.service.images == null).toBe(true);
  });

  it('2. unapproved vendor cannot publish services (publish blocked)', async () => {
    const { pendingUser } = await setupWorld();
    const token = signToken({ id: pendingUser.id, phone: pendingUser.phone, role: 'vendor' });

    const create = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'A tour', serviceType: 'TOUR', price: 1000 }
    });
    expect(create.status).toBe(403);
    expect(String(create.body.error)).toMatch(/approved/i);
  });

  it('3. vendor can read own services', async () => {
    const { vendorAUser } = await setupWorld();
    const token = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'Tour One', serviceType: 'TOUR', price: 500 }
    });
    await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'Tour Two', serviceType: 'TOUR', price: 600 }
    });

    const res = await request(app, 'GET', '/api/v1/vendors/me/services', { token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body.every((s: any) => typeof s.lifecycleStatus === 'string')).toBe(true);
  });

  it('4. vendor cannot read another vendor\'s service', async () => {
    const { vendorAUser, vendorBUser, vendorB } = await setupWorld();
    const aToken = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });
    const bToken = signToken({ id: vendorBUser.id, phone: vendorBUser.phone, role: 'vendor' });

    const created = await prisma.service.create({
      data: {
        providerId: vendorB.id,
        name: 'Hotel Room',
        category: 'hotel',
        serviceType: 'HOTEL',
        price: 4000,
        lifecycleStatus: 'PUBLISHED',
        status: 'ACTIVE',
        isActive: true
      }
    });

    const res = await request(app, 'GET', `/api/v1/vendors/me/services/${created.id}`, { token: aToken });
    expect(res.status).toBe(404);

    const ownRes = await request(app, 'GET', `/api/v1/vendors/me/services/${created.id}`, { token: bToken });
    expect(ownRes.status).toBe(200);
    expect(ownRes.body.id).toBe(created.id);
  });

  it('5. vendor can update own service', async () => {
    const { vendorAUser } = await setupWorld();
    const token = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const create = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'Old Name', serviceType: 'TOUR', price: 1000 }
    });
    const id = create.body.service.id;

    const res = await request(app, 'PATCH', `/api/v1/vendors/me/services/${id}`, {
      token,
      body: { name: 'New Name', price: 1500, description: 'Updated description' }
    });
    expect(res.status).toBe(200);
    expect(res.body.service.name).toBe('New Name');
    expect(res.body.service.price).toBe(1500);
    expect(res.body.service.description).toBe('Updated description');
  });

  it('6. vendor cannot update another vendor\'s service', async () => {
    const { vendorAUser, vendorBUser, vendorB } = await setupWorld();
    const aToken = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const created = await prisma.service.create({
      data: { providerId: vendorB.id, name: 'X', category: 'hotel', serviceType: 'HOTEL', price: 100, lifecycleStatus: 'DRAFT', status: 'INACTIVE', isActive: false }
    });

    const res = await request(app, 'PATCH', `/api/v1/vendors/me/services/${created.id}`, {
      token: aToken,
      body: { name: 'Hacked' }
    });
    expect(res.status).toBe(404);
  });

  it('7. vendor can delete own draft service', async () => {
    const { vendorAUser } = await setupWorld();
    const token = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const create = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'Draft', serviceType: 'TOUR', price: 100 }
    });
    const id = create.body.service.id;

    const res = await request(app, 'DELETE', `/api/v1/vendors/me/services/${id}`, { token });
    expect(res.status).toBe(200);

    const after = await prisma.service.findUnique({ where: { id } });
    expect(after).toBeNull();
  });

  it('8. vendor cannot delete another vendor\'s service', async () => {
    const { vendorAUser, vendorBUser, vendorB } = await setupWorld();
    const aToken = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const created = await prisma.service.create({
      data: { providerId: vendorB.id, name: 'B service', category: 'hotel', serviceType: 'HOTEL', price: 100, lifecycleStatus: 'DRAFT', status: 'INACTIVE', isActive: false }
    });

    const res = await request(app, 'DELETE', `/api/v1/vendors/me/services/${created.id}`, { token: aToken });
    expect(res.status).toBe(404);

    const after = await prisma.service.findUnique({ where: { id: created.id } });
    expect(after).not.toBeNull();
  });

  it('9. published service from approved vendor appears in public discover', async () => {
    const { vendorB } = await setupWorld();
    await prisma.service.create({
      data: {
        providerId: vendorB.id,
        name: 'Beach Resort',
        category: 'hotel',
        serviceType: 'HOTEL',
        price: 5000,
        lifecycleStatus: 'PUBLISHED',
        status: 'ACTIVE',
        isActive: true,
        locationCity: 'Cox\'s Bazar'
      }
    });

    const res = await request(app, 'GET', '/api/v1/vendor-services/discover');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.services[0].name).toBe('Beach Resort');
    expect(res.body.services[0].provider.businessName).toBe('Vendor B Hotels');
  });

  it('10. draft service does NOT appear in public discover', async () => {
    const { vendorB } = await setupWorld();
    await prisma.service.create({
      data: {
        providerId: vendorB.id,
        name: 'Draft Hidden',
        category: 'hotel',
        serviceType: 'HOTEL',
        price: 100,
        lifecycleStatus: 'DRAFT',
        status: 'INACTIVE',
        isActive: false
      }
    });

    const res = await request(app, 'GET', '/api/v1/vendor-services/discover');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it('11. rejected/suspended services do NOT appear in public discover', async () => {
    const { vendorB } = await setupWorld();
    await prisma.service.createMany({
      data: [
        {
          providerId: vendorB.id,
          name: 'Rejected One',
          category: 'hotel',
          serviceType: 'HOTEL',
          price: 100,
          lifecycleStatus: 'REJECTED',
          status: 'INACTIVE',
          isActive: false
        },
        {
          providerId: vendorB.id,
          name: 'Suspended One',
          category: 'hotel',
          serviceType: 'HOTEL',
          price: 100,
          lifecycleStatus: 'SUSPENDED',
          status: 'INACTIVE',
          isActive: false
        }
      ]
    });

    const res = await request(app, 'GET', '/api/v1/vendor-services/discover');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it('12. invalid price (negative) is rejected', async () => {
    const { vendorAUser } = await setupWorld();
    const token = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const res = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'Bad', serviceType: 'TOUR', price: -50 }
    });
    expect(res.status).toBe(400);
  });

  it('13. invalid category/serviceType is rejected', async () => {
    const { vendorAUser } = await setupWorld();
    const token = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const res = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'Bad', serviceType: 'NOT_A_TYPE', price: 50 }
    });
    expect(res.status).toBe(400);
  });

  it('14. unauthorized user (no token) is blocked', async () => {
    const res = await request(app, 'GET', '/api/v1/vendors/me/services');
    expect(res.status).toBe(401);
  });

  it('15. approved vendor can publish own draft service', async () => {
    const { vendorAUser } = await setupWorld();
    const token = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const create = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'To Publish', serviceType: 'TOUR', price: 200, lifecycleStatus: 'DRAFT' }
    });
    const id = create.body.service.id;

    const pub = await request(app, 'PATCH', `/api/v1/vendors/me/services/${id}/publish`, { token });
    expect(pub.status).toBe(200);
    expect(pub.body.service.lifecycleStatus).toBe('PUBLISHED');
    expect(pub.body.service.isActive).toBe(true);

    // Now it should appear publicly
    const disc = await request(app, 'GET', '/api/v1/vendor-services/discover');
    expect(disc.body.count).toBe(1);
  });

  it('16. approved vendor can unpublish own service', async () => {
    const { vendorAUser } = await setupWorld();
    const token = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const create = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'Pub', serviceType: 'TOUR', price: 300 }
    });
    const id = create.body.service.id;

    await request(app, 'PATCH', `/api/v1/vendors/me/services/${id}/publish`, { token });

    const unp = await request(app, 'PATCH', `/api/v1/vendors/me/services/${id}/unpublish`, { token });
    expect(unp.status).toBe(200);
    expect(unp.body.service.lifecycleStatus).toBe('DRAFT');
    expect(unp.body.service.isActive).toBe(false);

    const disc = await request(app, 'GET', '/api/v1/vendor-services/discover');
    expect(disc.body.count).toBe(0);
  });

  it('17. customer role cannot create a service', async () => {
    const { customer } = await setupWorld();
    const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

    const res = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { name: 'X', serviceType: 'TOUR', price: 100 }
    });
    expect(res.status).toBe(403);
  });

  it('18. admin can suspend then restore a service', async () => {
    const { adminUser, vendorB, vendorBUser } = await setupWorld();
    const adminToken = signToken({ id: adminUser.id, phone: adminUser.phone, role: 'admin' });

    const created = await prisma.service.create({
      data: {
        providerId: vendorB.id,
        name: 'Suspendable',
        category: 'hotel',
        serviceType: 'HOTEL',
        price: 100,
        lifecycleStatus: 'PUBLISHED',
        status: 'ACTIVE',
        isActive: true
      }
    });

    const susp = await request(app, 'PATCH', `/api/v1/admin/vendor-services/${created.id}/suspend`, { token: adminToken });
    expect(susp.status).toBe(200);
    expect(susp.body.service.lifecycleStatus).toBe('SUSPENDED');

    const restore = await request(app, 'PATCH', `/api/v1/admin/vendor-services/${created.id}/restore`, { token: adminToken });
    expect(restore.status).toBe(200);
    expect(restore.body.service.lifecycleStatus).toBe('PUBLISHED');
    expect(restore.body.service.isActive).toBe(true);

    // non-admin cannot suspend
    const vendorToken = signToken({ id: vendorBUser.id, phone: vendorBUser.phone, role: 'vendor' });
    const deny = await request(app, 'PATCH', `/api/v1/admin/vendor-services/${created.id}/suspend`, { token: vendorToken });
    expect(deny.status).toBe(403);
  });

  it('19. missing title is rejected', async () => {
    const { vendorAUser } = await setupWorld();
    const token = signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' });

    const res = await request(app, 'POST', '/api/v1/vendors/me/services', {
      token,
      body: { price: 100, serviceType: 'TOUR' }
    });
    expect(res.status).toBe(400);
  });
});