import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(30000);

import express from 'express';
import http from 'http';
import qrRoutes from '../src/routes/qr.routes';
import bookingRoutes from '../src/routes/booking.routes';
import authRoutes from '../src/routes/auth.routes';
import jwt from 'jsonwebtoken';

function signToken(user: { id: number; phone: string; role: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(user, secret, { expiresIn: '1h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/qr', qrRoutes);
  app.use('/api/v1/travel-passes', qrRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
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

async function setupQrWorld() {
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.seatLock.deleteMany();
      await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.user.deleteMany();

  const customer = await prisma.user.create({
    data: { phone: '01811000001', passwordHash: 'hash', role: 'customer', fullName: 'Alice Customer' }
  });
  const otherCustomer = await prisma.user.create({
    data: { phone: '01811000002', passwordHash: 'hash', role: 'customer', fullName: 'Bob Customer' }
  });
  const vendor = await prisma.user.create({
    data: { phone: '01911000001', passwordHash: 'hash', role: 'vendor', fullName: 'Vendor One' }
  });
  const otherVendor = await prisma.user.create({
    data: { phone: '01911000002', passwordHash: 'hash', role: 'vendor', fullName: 'Vendor Two' }
  });
  const admin = await prisma.user.create({
    data: { phone: '01711000001', passwordHash: 'hash', role: 'admin', fullName: 'Admin' }
  });
  const provider = await prisma.serviceProvider.create({
    data: {
      userId: vendor.id,
      businessName: 'Green Line',
      category: 'bus',
      address: 'Dhaka',
      phone: '01911000001',
      status: 'APPROVED',
      isVerified: true,
      isActive: true
    }
  });
  const otherProvider = await prisma.serviceProvider.create({
    data: {
      userId: otherVendor.id,
      businessName: 'Blue Line',
      category: 'bus',
      address: 'Chittagong',
      phone: '01911000002',
      status: 'APPROVED',
      isVerified: true,
      isActive: true
    }
  });

  const booking = await prisma.booking.create({
    data: {
      userId: customer.id,
      providerId: provider.id,
      category: 'bus',
      bookingDate: new Date(),
      travelDate: new Date('2026-12-15T10:00:00Z'),
      numberOfPeople: 1,
      totalAmount: 1200,
      discountAmount: 0,
      finalAmount: 1200,
      status: 'confirmed',
      paymentStatus: 'paid'
    }
  });

  return { customer, otherCustomer, vendor, otherVendor, admin, provider, otherProvider, booking };
}

describe('Travel Pass / QR MVP', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.review.deleteMany();
    await prisma.qrLog.deleteMany();
    await prisma.seatLock.deleteMany();
        await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.user.deleteMany();
  });

  const app = createApp();

  // ============================================================================
  // QR / TRAVEL PASS ISSUANCE (shared by Web + Mobile)
  // ============================================================================
  describe('Issuance', () => {
    it('1. Customer can issue a travel pass for their own booking', async () => {
      const { customer, booking } = await setupQrWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/travel-passes', {
        token,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(200);
      expect(res.body.bookingId).toBe(booking.id);
      expect(res.body.travelPass.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(res.body.travelPass.token).toBeDefined();
      expect(res.body.travelPass.validFrom).toBeDefined();
      expect(res.body.travelPass.validUntil).toBeDefined();
    });

    it('2. Same token is reused on re-issuance (stable across calls)', async () => {
      const { customer, booking } = await setupQrWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const first = await request(app, 'POST', '/api/v1/travel-passes', {
        token,
        body: { bookingId: booking.id }
      });
      const second = await request(app, 'POST', '/api/v1/travel-passes', {
        token,
        body: { bookingId: booking.id }
      });
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.travelPass.token).toBe(first.body.travelPass.token);
    });

    it('3. Other customer cannot issue a travel pass for someone else', async () => {
      const { otherCustomer, booking } = await setupQrWorld();
      const token = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/travel-passes', {
        token,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(403);
    });

    it('4. Issuing for cancelled booking rejected', async () => {
      const { customer, booking } = await setupQrWorld();
      await prisma.booking.update({ where: { id: booking.id }, data: { status: 'cancelled' } });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/travel-passes', {
        token,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cancelled/);
    });

    it('5. QR payload does NOT contain PII like user_id', async () => {
      const { customer, booking } = await setupQrWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'POST', '/api/v1/travel-passes', {
        token,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(200);
      const json = JSON.stringify(res.body.travelPass.qrObject);
      expect(json).not.toMatch(/user_id|USR-/);
      expect(json).toMatch(/"tp":/);
      expect(json).toMatch(/"bkg":/);
    });
  });

  // ============================================================================
  // TRAVEL PASS RETRIEVAL
  // ============================================================================
  describe('Retrieval', () => {
    it('6. GET /travel-passes/:code returns pass metadata for owner', async () => {
      const { customer, booking } = await setupQrWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      await request(app, 'POST', '/api/v1/travel-passes', { token, body: { bookingId: booking.id } });

      const res = await request(app, 'GET', `/api/v1/travel-passes/${booking.bookingCode}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.bookingCode).toBe(booking.bookingCode);
      expect(res.body.validFrom).toBeDefined();
      expect(res.body.validUntil).toBeDefined();
      expect(res.body.status).toBe('confirmed');
    });

    it('7. Other customer cannot retrieve someone else\'s travel pass', async () => {
      const { otherCustomer, booking } = await setupQrWorld();
      const token = signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: 'customer' });

      const res = await request(app, 'GET', `/api/v1/travel-passes/${booking.bookingCode}`, { token });
      expect(res.status).toBe(403);
    });

    it('8. Returns "expired" status when travel date is past expiry', async () => {
      const { customer, booking } = await setupQrWorld();
      // Move travel date 30 days in the past
      const past = new Date();
      past.setDate(past.getDate() - 30);
      await prisma.booking.update({ where: { id: booking.id }, data: { travelDate: past } });
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'GET', `/api/v1/travel-passes/${booking.bookingCode}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('expired');
    });
  });

  // ============================================================================
  // QR VERIFICATION (shared with Web scanner + Mobile scanner)
  // ============================================================================
  describe('Verification', () => {
    it('9. Vendor can verify a valid travel pass for their own provider', async () => {
      const { customer, vendor, booking } = await setupQrWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const issueRes = await request(app, 'POST', '/api/v1/travel-passes', { token: custToken, body: { bookingId: booking.id } });
      expect(issueRes.status).toBe(200);

      const verifyRes = await request(app, 'POST', '/api/v1/travel-passes/verify', {
        token: vendToken,
        body: { qrData: issueRes.body.travelPass.qrObject }
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
      expect(verifyRes.body.bookingCode).toBe(booking.bookingCode);
    });

    it('10. Admin can verify any travel pass', async () => {
      const { customer, admin, booking } = await setupQrWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const adminToken = signToken({ id: admin.id, phone: admin.phone, role: 'admin' });

      const issueRes = await request(app, 'POST', '/api/v1/travel-passes', { token: custToken, body: { bookingId: booking.id } });

      const verifyRes = await request(app, 'POST', '/api/v1/travel-passes/verify', {
        token: adminToken,
        body: { qrData: issueRes.body.travelPass.qrObject }
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
    });

    it('11. Vendor cannot verify a travel pass for another vendor\'s provider', async () => {
      const { customer, otherVendor, booking } = await setupQrWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const otherVendToken = signToken({ id: otherVendor.id, phone: otherVendor.phone, role: 'vendor' });

      const issueRes = await request(app, 'POST', '/api/v1/travel-passes', { token: custToken, body: { bookingId: booking.id } });

      const verifyRes = await request(app, 'POST', '/api/v1/travel-passes/verify', {
        token: otherVendToken,
        body: { qrData: issueRes.body.travelPass.qrObject }
      });
      expect(verifyRes.status).toBe(403);
    });

    it('12. Customer cannot use the verify endpoint (403)', async () => {
      const { customer, booking } = await setupQrWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const issueRes = await request(app, 'POST', '/api/v1/travel-passes', { token: custToken, body: { bookingId: booking.id } });

      const verifyRes = await request(app, 'POST', '/api/v1/travel-passes/verify', {
        token: custToken,
        body: { qrData: issueRes.body.travelPass.qrObject }
      });
      expect(verifyRes.status).toBe(403);
    });

    it('13. Tampered signature rejected', async () => {
      const { customer, vendor, booking } = await setupQrWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const issueRes = await request(app, 'POST', '/api/v1/travel-passes', { token: custToken, body: { bookingId: booking.id } });
      const tampered = {
        payload: issueRes.body.travelPass.qrObject.payload,
        signature: 'deadbeef'.repeat(8) // 64 hex chars
      };

      const verifyRes = await request(app, 'POST', '/api/v1/travel-passes/verify', {
        token: vendToken,
        body: { qrData: tampered }
      });
      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.valid).toBe(false);
    });

    it('14. Cancelled booking cannot be verified', async () => {
      const { customer, vendor, booking } = await setupQrWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const issueRes = await request(app, 'POST', '/api/v1/travel-passes', { token: custToken, body: { bookingId: booking.id } });
      await prisma.booking.update({ where: { id: booking.id }, data: { status: 'cancelled' } });

      const verifyRes = await request(app, 'POST', '/api/v1/travel-passes/verify', {
        token: vendToken,
        body: { qrData: issueRes.body.travelPass.qrObject }
      });
      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.valid).toBe(false);
    });

    it('15. Replay protection: second scan of same QR same day rejected', async () => {
      const { customer, vendor, booking } = await setupQrWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const issueRes = await request(app, 'POST', '/api/v1/travel-passes', { token: custToken, body: { bookingId: booking.id } });

      const first = await request(app, 'POST', '/api/v1/travel-passes/verify', {
        token: vendToken,
        body: { qrData: issueRes.body.travelPass.qrObject }
      });
      expect(first.status).toBe(200);

      const second = await request(app, 'POST', '/api/v1/travel-passes/verify', {
        token: vendToken,
        body: { qrData: issueRes.body.travelPass.qrObject }
      });
      expect(second.status).toBe(409);
      expect(second.body.valid).toBe(false);
    });

    it('16. QR string (not parsed object) also accepted', async () => {
      const { customer, vendor, booking } = await setupQrWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const issueRes = await request(app, 'POST', '/api/v1/travel-passes', { token: custToken, body: { bookingId: booking.id } });
      const qrString = JSON.stringify(issueRes.body.travelPass.qrObject);

      const verifyRes = await request(app, 'POST', '/api/v1/travel-passes/verify', {
        token: vendToken,
        body: { qrData: qrString }
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY WITH EXISTING /api/v1/qr ROUTES
  // ============================================================================
  describe('Backward compatibility ( /api/v1/qr )', () => {
    it('17. GET /qr/generate/:id still works', async () => {
      const { customer, booking } = await setupQrWorld();
      const token = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });

      const res = await request(app, 'GET', `/api/v1/qr/generate/${booking.id}`, { token });
      expect(res.status).toBe(200);
      expect(res.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('18. POST /qr/verify still works (legacy alias)', async () => {
      const { customer, vendor, booking } = await setupQrWorld();
      const custToken = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const vendToken = signToken({ id: vendor.id, phone: vendor.phone, role: 'vendor' });

      const issueRes = await request(app, 'POST', '/api/v1/travel-passes', { token: custToken, body: { bookingId: booking.id } });
      const verifyRes = await request(app, 'POST', '/api/v1/qr/verify', {
        token: vendToken,
        body: { qrData: issueRes.body.travelPass.qrObject }
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
    });
  });
});