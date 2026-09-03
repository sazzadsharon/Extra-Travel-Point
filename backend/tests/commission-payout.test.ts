import { PrismaClient } from '@prisma/client';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import serviceBookingRoutes from '../src/routes/service-booking.routes';
import bookingRoutes from '../src/routes/booking.routes';
import authRoutes from '../src/routes/auth.routes';
import paymentRoutes from '../src/routes/payment.routes';
import vendorFinanceRoutes from '../src/routes/vendor-finance.routes';
import adminPayoutRoutes from '../src/routes/admin-payouts.routes';
import {
  ensureSettlementForPaidBooking,
  calculateCommission,
  PAYOUT_STATUS
} from '../src/utils/commission';

const prisma = new PrismaClient();

jest.setTimeout(30000);

function signToken(user: { id: number; phone: string; role: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(user, secret, { expiresIn: '1h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/services', serviceBookingRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/vendors', vendorFinanceRoutes);
  app.use('/api/v1/admin', adminPayoutRoutes);
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
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body: any = text;
          try { body = JSON.parse(text); } catch { /* leave as text */ }
          resolve({ status: res.statusCode || 0, body });
          server.close();
        });
      });
      req.on('error', (err) => { reject(err); server.close(); });
      if (data) req.write(data);
      req.end();
    });
  });
}

interface World {
  app: express.Express;
  customerToken: string;
  otherCustomerToken: string;
  vendorAToken: string;
  vendorBToken: string;
  adminToken: string;
  customer: any;
  vendorAUser: any;
  vendorAProvider: any;
  vendorBUser: any;
  vendorBProvider: any;
  admin: any;
  service: any;
}

async function setupWorld(): Promise<World> {
  await prisma.payment.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.review.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.serviceAvailability.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const customer = await prisma.user.create({
    data: { phone: '01811111111', passwordHash: 'hash', role: 'customer', fullName: 'Customer' }
  });
  const otherCustomer = await prisma.user.create({
    data: { phone: '01811111112', passwordHash: 'hash', role: 'customer', fullName: 'Other' }
  });
  const admin = await prisma.user.create({
    data: { phone: '01711111111', passwordHash: 'hash', role: 'admin', fullName: 'Admin' }
  });

  // Vendor A — APPROVED, KYC APPROVED, with a service
  const vendorAUser = await prisma.user.create({
    data: { phone: '01911111111', passwordHash: 'hash', role: 'vendor', fullName: 'Vendor A' }
  });
  const vendorAProvider = await prisma.serviceProvider.create({
    data: {
      userId: vendorAUser.id,
      businessName: 'Vendor A Tours',
      category: 'tour',
      address: 'Dhaka',
      city: 'Dhaka',
      status: 'APPROVED',
      isVerified: true,
      isActive: true,
      kycStatus: 'APPROVED',
      commissionRate: 10.0
    }
  });

  // Vendor B — also approved, for isolation tests
  const vendorBUser = await prisma.user.create({
    data: { phone: '01911111112', passwordHash: 'hash', role: 'vendor', fullName: 'Vendor B' }
  });
  const vendorBProvider = await prisma.serviceProvider.create({
    data: {
      userId: vendorBUser.id,
      businessName: 'Vendor B Tours',
      category: 'tour',
      address: 'Dhaka',
      status: 'APPROVED',
      isVerified: true,
      isActive: true,
      kycStatus: 'APPROVED',
      commissionRate: 10.0
    }
  });

  const service = await prisma.service.create({
    data: {
      providerId: vendorAProvider.id,
      name: 'Sundarbans Day Tour',
      category: 'tour',
      serviceType: 'TOUR',
      price: 1000,
      currency: 'BDT',
      status: 'ACTIVE',
      isActive: true,
      lifecycleStatus: 'PUBLISHED',
      locationCity: 'Khulna',
      availableDays: JSON.stringify([0, 1, 2, 3, 4, 5, 6])
    }
  });

  return {
    app: createApp(),
    customerToken: signToken({ id: customer.id, phone: customer.phone, role: 'customer' }),
    otherCustomerToken: signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: 'customer' }),
    vendorAToken: signToken({ id: vendorAUser.id, phone: vendorAUser.phone, role: 'vendor' }),
    vendorBToken: signToken({ id: vendorBUser.id, phone: vendorBUser.phone, role: 'vendor' }),
    adminToken: signToken({ id: admin.id, phone: admin.phone, role: 'admin' }),
    customer,
    vendorAUser,
    vendorAProvider,
    vendorBUser,
    vendorBProvider,
    admin,
    service
  };
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

async function createPaidServiceBooking(w: World, opts: { quantity?: number; amount?: number } = {}) {
  const quantity = opts.quantity ?? 1;
  const create = await request(w.app, 'POST', `/api/v1/services/${w.service.id}/book`, {
    token: w.customerToken,
    body: { bookingDate: futureDate(7), quantity }
  });
  if (create.status !== 201) throw new Error(`Booking create failed: ${create.status}`);
  const bookingId = create.body.booking.id;

  const init = await request(w.app, 'POST', '/api/v1/payments/initiate', {
    token: w.customerToken,
    body: { bookingId, method: 'bkash', amount: 1 }
  });
  if (init.status !== 201) throw new Error(`Payment init failed: ${init.status}`);

  const verify = await request(w.app, 'POST', '/api/v1/payments/verify', {
    token: w.customerToken,
    body: { transactionId: init.body.transactionId }
  });
  if (verify.status !== 200) throw new Error(`Payment verify failed: ${verify.status}`);
  return { bookingId, finalAmount: create.body.booking.finalAmount, transactionId: init.body.transactionId };
}

describe('Commission, Settlement & Payout System', () => {
  let w: World;

  beforeAll(async () => {
    w = await setupWorld();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.qrLog.deleteMany();
    await prisma.booking.deleteMany();
  });

  // ------------------------------------------------------------------
  // Commission math (pure unit)
  // ------------------------------------------------------------------
  describe('calculateCommission (pure math)', () => {
    it('computes correct gross/commission/vendor for 1000 @ 10%', () => {
      const r = calculateCommission({ grossAmount: 1000, commissionRate: 10 });
      expect(r.grossAmount).toBe(1000);
      expect(r.commissionRate).toBe(10);
      expect(r.commissionAmount).toBe(100);
      expect(r.vendorAmount).toBe(900);
    });

    it('rounds to 2 decimals without floating-point drift', () => {
      const r = calculateCommission({ grossAmount: 333.33, commissionRate: 10 });
      expect(r.commissionAmount).toBe(33.33);
      expect(r.vendorAmount).toBe(300);
    });

    it('falls back to default 10% when rate is missing', () => {
      const r = calculateCommission({ grossAmount: 2000 });
      expect(r.commissionRate).toBe(10);
      expect(r.commissionAmount).toBe(200);
      expect(r.vendorAmount).toBe(1800);
    });

    it('throws on invalid gross', () => {
      expect(() => calculateCommission({ grossAmount: -1 })).toThrow();
      expect(() => calculateCommission({ grossAmount: NaN })).toThrow();
    });
  });

  // ------------------------------------------------------------------
  // Settlement creation
  // ------------------------------------------------------------------
  describe('Settlement creation', () => {
    it('paid service booking creates one settlement with correct amounts', async () => {
      const { bookingId } = await createPaidServiceBooking(w);
      const settlements = await prisma.settlement.findMany({ where: { bookingId } });
      expect(settlements.length).toBe(1);
      expect(settlements[0].grossAmount).toBe(1000);
      expect(settlements[0].commissionRate).toBe(10);
      expect(settlements[0].commissionAmount).toBe(100);
      expect(settlements[0].netAmount).toBe(900);
      expect(settlements[0].providerId).toBe(w.vendorAProvider.id);
      expect(settlements[0].serviceId).toBe(w.service.id);
      expect(settlements[0].status).toBe('pending');
    });

    it('repeated payment verification does not duplicate settlement (idempotency)', async () => {
      const { bookingId, transactionId } = await createPaidServiceBooking(w);
      // Try verifying again with the same transactionId — must not duplicate.
      await request(w.app, 'POST', '/api/v1/payments/verify', {
        token: w.customerToken,
        body: { transactionId }
      });
      const settlements = await prisma.settlement.findMany({ where: { bookingId } });
      expect(settlements.length).toBe(1);
    });

    it('calling ensureSettlementForPaidBooking twice does not duplicate settlement', async () => {
      const { bookingId } = await createPaidServiceBooking(w);
      await ensureSettlementForPaidBooking(bookingId);
      await ensureSettlementForPaidBooking(bookingId);
      const settlements = await prisma.settlement.findMany({ where: { bookingId } });
      expect(settlements.length).toBe(1);
    });

    it('unpaid booking does not create settlement', async () => {
      const create = await request(w.app, 'POST', `/api/v1/services/${w.service.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 1 }
      });
      const bookingId = create.body.booking.id;
      await ensureSettlementForPaidBooking(bookingId);
      const settlements = await prisma.settlement.findMany({ where: { bookingId } });
      expect(settlements.length).toBe(0);
    });

    it('Bus Booking (no serviceId) does NOT create vendor settlement', async () => {
      // Create a plain bus booking (no serviceId) and force payment.
      const bus = await prisma.booking.create({
        data: {
          userId: w.customer.id,
          providerId: w.vendorAProvider.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(),
          totalAmount: 500,
          discountAmount: 0,
          finalAmount: 500,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });
      await ensureSettlementForPaidBooking(bus.id);
      const settlements = await prisma.settlement.findMany({ where: { bookingId: bus.id } });
      expect(settlements.length).toBe(0);
    });

    it('vendor A cannot access vendor B settlement by id', async () => {
      const { bookingId } = await createPaidServiceBooking(w);
      const vendorA = await prisma.serviceProvider.findUnique({ where: { id: w.vendorAProvider.id } });
      // Admin can list all
      const list = await request(w.app, 'GET', '/api/v1/admin/payouts', { token: w.adminToken });
      expect(list.status).toBe(200);
      // Vendor A can see own settlement in /vendors/me/settlements
      const ownList = await request(w.app, 'GET', '/api/v1/vendors/me/settlements', { token: w.vendorAToken });
      expect(ownList.status).toBe(200);
      expect(ownList.body.settlements.length).toBeGreaterThanOrEqual(1);
      expect(ownList.body.settlements.every((s: any) => s.providerId === vendorA?.id)).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // Vendor balance & earnings
  // ------------------------------------------------------------------
  describe('Vendor earnings/balance', () => {
    it('unauthenticated vendor cannot access earnings', async () => {
      const res = await request(w.app, 'GET', '/api/v1/vendors/me/earnings');
      expect(res.status).toBe(401);
    });

    it('customer cannot access vendor earnings', async () => {
      const res = await request(w.app, 'GET', '/api/v1/vendors/me/earnings', {
        token: w.customerToken
      });
      expect(res.status).toBe(403);
    });

    it('shows correct gross/commission/net/available', async () => {
      // Create 3 paid bookings of 1000 each
      await createPaidServiceBooking(w);
      await createPaidServiceBooking(w);
      await createPaidServiceBooking(w);

      const res = await request(w.app, 'GET', '/api/v1/vendors/me/earnings', {
        token: w.vendorAToken
      });
      expect(res.status).toBe(200);
      expect(res.body.balance.grossSales).toBe(3000);
      expect(res.body.balance.commissionTotal).toBe(300);
      expect(res.body.balance.netEarnings).toBe(2700);
      expect(res.body.balance.paidOut).toBe(0);
      expect(res.body.balance.availableBalance).toBe(2700);
      expect(res.body.balance.payoutRequested).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Payout requests
  // ------------------------------------------------------------------
  describe('Vendor payout requests', () => {
    beforeEach(async () => {
      await createPaidServiceBooking(w); // 900 available
    });

    it('can request payout from available balance', async () => {
      const res = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount: 500, method: 'BANK' }
      });
      expect(res.status).toBe(201);
      expect(res.body.payout.amount).toBe(500);
      expect(res.body.payout.status).toBe('PAYOUT_REQUESTED');
      expect(res.body.payout.providerId).toBe(w.vendorAProvider.id);
    });

    it('cannot request zero amount', async () => {
      const res = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount: 0, method: 'BANK' }
      });
      expect(res.status).toBe(400);
    });

    it('cannot request negative amount', async () => {
      const res = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount: -100, method: 'BANK' }
      });
      expect(res.status).toBe(400);
    });

    it('cannot request more than available balance', async () => {
      const res = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount: 5000, method: 'BANK' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceeds available balance/);
    });

    it('cannot request with invalid method', async () => {
      const res = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount: 100, method: 'PAYPAL' }
      });
      expect(res.status).toBe(400);
    });

    it('two payouts cannot overspend balance (double-spend protection)', async () => {
      // Available = 900. Two requests of 500 each would overspend.
      const r1 = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount: 500, method: 'BANK' }
      });
      expect(r1.status).toBe(201);
      const r2 = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount: 500, method: 'BANK' }
      });
      expect(r2.status).toBe(400); // 500 + 500 open payouts would overspend 900 available
    });

    it('vendor without APPROVED KYC cannot request payout', async () => {
      await prisma.serviceProvider.update({
        where: { id: w.vendorAProvider.id },
        data: { kycStatus: 'NOT_SUBMITTED' }
      });
      const res = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount: 100, method: 'BANK' }
      });
      expect(res.status).toBe(403);
      // Restore KYC
      await prisma.serviceProvider.update({
        where: { id: w.vendorAProvider.id },
        data: { kycStatus: 'APPROVED' }
      });
    });

    it('customer cannot create a payout request', async () => {
      const res = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.customerToken,
        body: { amount: 100, method: 'BANK' }
      });
      expect(res.status).toBe(403);
    });

    it('cannot forge providerId on payout endpoint (no providerId param accepted)', async () => {
      // Confirm server ignores any providerId hint from the client. Vendor B
      // has zero balance, so even though the client tries to attribute the
      // request to vendor A, the server attributes it to vendor B (req.user)
      // and the request is rejected due to insufficient balance.
      const res = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorBToken,
        body: { amount: 100, method: 'BANK', providerId: w.vendorAProvider.id }
      });
      expect(res.status).toBe(400);
      // Check that no payout was created for vendor A
      const aList = await prisma.payoutRequest.findMany({ where: { providerId: w.vendorAProvider.id } });
      expect(aList.length).toBe(0);
      // And no payout was created for vendor B either (insufficient balance)
      const bList = await prisma.payoutRequest.findMany({ where: { providerId: w.vendorBProvider.id } });
      expect(bList.length).toBe(0);
    });

    it('vendor B cannot see vendor A payouts (isolation)', async () => {
      // vendor A creates one
      await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount: 100, method: 'BANK' }
      });
      const bList = await request(w.app, 'GET', '/api/v1/vendors/me/payouts', {
        token: w.vendorBToken
      });
      expect(bList.status).toBe(200);
      expect(bList.body.count).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Admin payout management
  // ------------------------------------------------------------------
  describe('Admin payout management', () => {
    let payoutId: number;

    beforeEach(async () => {
      await createPaidServiceBooking(w); // 900 available
    });

    async function requestPayout(amount: number, method: string = 'BANK') {
      const res = await request(w.app, 'POST', '/api/v1/vendors/me/payouts', {
        token: w.vendorAToken,
        body: { amount, method }
      });
      return res;
    }

    it('customer cannot access admin payout endpoints', async () => {
      payoutId = (await requestPayout(500)).body.payout.id;
      const res = await request(w.app, 'GET', '/api/v1/admin/payouts', {
        token: w.customerToken
      });
      expect(res.status).toBe(403);
    });

    it('vendor cannot access admin payout endpoints', async () => {
      payoutId = (await requestPayout(500)).body.payout.id;
      const res = await request(w.app, 'GET', '/api/v1/admin/payouts', {
        token: w.vendorAToken
      });
      expect(res.status).toBe(403);
    });

    it('admin can view payouts', async () => {
      payoutId = (await requestPayout(500)).body.payout.id;
      const list = await request(w.app, 'GET', '/api/v1/admin/payouts', {
        token: w.adminToken
      });
      expect(list.status).toBe(200);
      expect(list.body.payouts.some((p: any) => p.id === payoutId)).toBe(true);
    });

    it('admin can approve payout (PAYOUT_REQUESTED -> PROCESSING)', async () => {
      payoutId = (await requestPayout(500)).body.payout.id;
      const res = await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/approve`, {
        token: w.adminToken,
        body: {}
      });
      expect(res.status).toBe(200);
      expect(res.body.payout.status).toBe('PROCESSING');
    });

    it('admin can mark approved payout as PAID (full settlement coverage)', async () => {
      // Use 900 (full net amount) so the settlement becomes PAID.
      payoutId = (await requestPayout(900)).body.payout.id;
      await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/approve`, {
        token: w.adminToken,
        body: {}
      });
      const res = await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/mark-paid`, {
        token: w.adminToken,
        body: { transactionRef: 'BANK-TXN-123' }
      });
      expect(res.status).toBe(200);
      expect(res.body.payout.status).toBe('PAID');
      expect(res.body.payout.transactionRef).toBe('BANK-TXN-123');

      // After PAID, the underlying settlement should also be PAID
      const settlement = await prisma.settlement.findFirst({
        where: { providerId: w.vendorAProvider.id, status: 'paid' }
      });
      expect(settlement).not.toBeNull();

      const bal = await request(w.app, 'GET', '/api/v1/vendors/me/earnings', {
        token: w.vendorAToken
      });
      expect(bal.body.balance.paidOut).toBe(900);
      expect(bal.body.balance.availableBalance).toBe(0);
    });

    it('admin can reject payout (PAYOUT_REQUESTED -> REJECTED)', async () => {
      payoutId = (await requestPayout(500)).body.payout.id;
      const res = await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/reject`, {
        token: w.adminToken,
        body: { reason: 'Bank details missing' }
      });
      expect(res.status).toBe(200);
      expect(res.body.payout.status).toBe('REJECTED');
      // After REJECTED, available balance should be restored
      const bal = await request(w.app, 'GET', '/api/v1/vendors/me/earnings', {
        token: w.vendorAToken
      });
      expect(bal.body.balance.availableBalance).toBe(900);
    });

    it('cannot approve a PAID payout (state transition enforced)', async () => {
      payoutId = (await requestPayout(900)).body.payout.id;
      await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/approve`, {
        token: w.adminToken,
        body: {}
      });
      await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/mark-paid`, {
        token: w.adminToken,
        body: { transactionRef: 'BANK-TXN-123' }
      });
      const res = await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/approve`, {
        token: w.adminToken,
        body: {}
      });
      expect(res.status).toBe(400);
    });

    it('cannot mark a REJECTED payout as paid (state transition enforced)', async () => {
      payoutId = (await requestPayout(500)).body.payout.id;
      await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/reject`, {
        token: w.adminToken,
        body: { reason: 'Insufficient info' }
      });
      const res = await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/mark-paid`, {
        token: w.adminToken,
        body: { transactionRef: 'BANK-TXN-XYZ' }
      });
      expect(res.status).toBe(400);
    });

    it('rejecting without reason is rejected', async () => {
      payoutId = (await requestPayout(500)).body.payout.id;
      const res = await request(w.app, 'PATCH', `/api/v1/admin/payouts/${payoutId}/reject`, {
        token: w.adminToken,
        body: { reason: 'a' } // < 3 chars
      });
      expect(res.status).toBe(400);
    });
  });

  // ------------------------------------------------------------------
  // Regression: existing flows still work
  // ------------------------------------------------------------------
  describe('Regression', () => {
    it('Bus Booking + payment still works (no settlement created)', async () => {
      const bus = await prisma.booking.create({
        data: {
          userId: w.customer.id,
          providerId: w.vendorAProvider.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(),
          totalAmount: 500,
          discountAmount: 0,
          finalAmount: 500,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });
      const init = await request(w.app, 'POST', '/api/v1/payments/initiate', {
        token: w.customerToken,
        body: { bookingId: bus.id, method: 'bkash', amount: 500 }
      });
      expect(init.status).toBe(201);
      const verify = await request(w.app, 'POST', '/api/v1/payments/verify', {
        token: w.customerToken,
        body: { transactionId: init.body.transactionId }
      });
      expect(verify.status).toBe(200);
      const settlements = await prisma.settlement.findMany({ where: { bookingId: bus.id } });
      expect(settlements.length).toBe(0);
    });
  });
});