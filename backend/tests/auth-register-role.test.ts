import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(30000);

import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import authRoutes from '../src/routes/auth.routes';
import adminRoutes from '../src/routes/admin.routes';
import vendorRoutes from '../src/routes/vendor.routes';

function signToken(user: { id: number; phone: string; role: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(user, secret, { expiresIn: '1h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/vendors', vendorRoutes);
  app.use('/api/v1/admin', adminRoutes);
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

async function wipeAll() {
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.seatLock.deleteMany();
      await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

describe('Auth registration role hardening', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await wipeAll(); });

  const app = createApp();

  it('normal registration creates a customer', async () => {
    const res = await request(app, 'POST', '/api/v1/auth/register', {
      body: { phone: '01700000101', fullName: 'Normal User', email: 'user@example.com', password: 'Test1234' }
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });

  it('registration with role=admin is ignored and creates a customer', async () => {
    const res = await request(app, 'POST', '/api/v1/auth/register', {
      body: { phone: '01700000102', fullName: 'Fake Admin', email: 'fakeadmin@example.com', password: 'Test1234', role: 'admin' }
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });

  it('registration with role=vendor is ignored and creates a customer', async () => {
    const res = await request(app, 'POST', '/api/v1/auth/register', {
      body: { phone: '01700000103', fullName: 'Fake Vendor', email: 'fakevendor@example.com', password: 'Test1234', role: 'vendor' }
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });

  it('registration with role=master_admin is ignored and creates a customer', async () => {
    const res = await request(app, 'POST', '/api/v1/auth/register', {
      body: { phone: '01700000104', fullName: 'Super Impersonator', email: 'imp@example.com', password: 'Test1234', role: 'master_admin' }
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });

  it('registration never assigns admin privileges in the database', async () => {
    await request(app, 'POST', '/api/v1/auth/register', {
      body: { phone: '01700000105', password: 'Test1234', role: 'admin' }
    });
    const dbUser = await prisma.user.findUnique({ where: { phone: '01700000105' } });
    expect(dbUser?.role).toBe('customer');
  });
});

describe('Master Admin preservation', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await wipeAll(); });

  const app = createApp();

  it('an existing admin-role user retains full access to admin endpoints', async () => {
    const admin = await prisma.user.create({
      data: { phone: '01710000001', passwordHash: 'hash', role: 'admin', fullName: 'Master Admin' }
    });
    const token = signToken({ id: admin.id, phone: admin.phone, role: admin.role });
    const res = await request(app, 'GET', '/api/v1/admin/users', { token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('an existing admin cannot be deactivated through the admin toggle endpoint', async () => {
    const admin = await prisma.user.create({
      data: { phone: '01710000001', passwordHash: 'hash', role: 'admin', fullName: 'Master Admin' }
    });
    const act = await prisma.user.create({
      data: { phone: '01711000099', passwordHash: 'hash', role: 'admin', fullName: 'Admin Acting' }
    });
    const token = signToken({ id: act.id, phone: act.phone, role: act.role });
    const res = await request(app, 'PATCH', `/api/v1/admin/users/${admin.id}/toggle`, { token });
    expect(res.status).toBe(403);
  });

  it('a master_admin-role user cannot be deactivated through the admin toggle endpoint', async () => {
    const master = await prisma.user.create({
      data: { phone: '01710000002', passwordHash: 'hash', role: 'master_admin', fullName: 'Master' }
    });
    const act = await prisma.user.create({
      data: { phone: '01711000098', passwordHash: 'hash', role: 'admin', fullName: 'Admin Acting' }
    });
    const token = signToken({ id: act.id, phone: act.phone, role: act.role });
    const res = await request(app, 'PATCH', `/api/v1/admin/users/${master.id}/toggle`, { token });
    expect(res.status).toBe(403);
  });

  it('a master_admin-role user is treated as an administrator for auth checks', async () => {
    const { isMasterAdmin } = require('../src/middleware/auth');
    expect(isMasterAdmin({ id: 1, phone: 'x', role: 'master_admin' })).toBe(true);
    expect(isMasterAdmin({ id: 1, phone: 'x', role: 'customer' })).toBe(false);
    expect(isMasterAdmin(undefined)).toBe(false);
  });
});

describe('Vendor onboarding still works', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await wipeAll(); });

  const app = createApp();

  it('vendor registration creates a vendor-role user', async () => {
    const res = await request(app, 'POST', '/api/v1/vendors/register', {
      body: {
        phone: '01900000202',
        password: 'Test1234',
        fullName: 'Vendor Person',
        businessName: 'Coastal Buses Ltd',
        category: 'bus',
        address: 'Khulna Road, Khulna'
      }
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('vendor');
  });
});

describe('Customer login still works', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await wipeAll(); });

  const app = createApp();

  it('a registered customer can log in and receive tokens', async () => {
    await request(app, 'POST', '/api/v1/auth/register', {
      body: { phone: '01700000166', fullName: 'Login User', email: 'login@example.com', password: 'Test1234' }
    });
    const res = await request(app, 'POST', '/api/v1/auth/login', {
      body: { phone: '01700000166', password: 'Test1234' }
    });
    expect(res.status).toBe(200);
    expect(res.body.tokens?.accessToken).toBeTruthy();
    expect(res.body.user.role).toBe('customer');
  });
});
