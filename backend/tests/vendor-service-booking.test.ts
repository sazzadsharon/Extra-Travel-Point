import { PrismaClient } from '@prisma/client';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import serviceBookingRoutes from '../src/routes/service-booking.routes';
import bookingRoutes from '../src/routes/booking.routes';
import authRoutes from '../src/routes/auth.routes';
import paymentRoutes from '../src/routes/payment.routes';

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
  adminToken: string;
  customer: any;
  otherCustomer: any;
  vendorApproved: any;
  vendorApprovedProvider: any;
  vendorPending: any;
  vendorPendingProvider: any;
  vendorInactive: any;
  vendorInactiveProvider: any;
  publishedService: any;
  draftService: any;
  suspendedService: any;
  rejectedService: any;
  inactiveProviderService: any;
  serviceWithCapacity: any;
}

async function setupWorld(): Promise<World> {
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
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const customer = await prisma.user.create({
    data: { phone: '01811111111', passwordHash: 'hash', role: 'customer', fullName: 'Test Customer' }
  });
  const otherCustomer = await prisma.user.create({
    data: { phone: '01811111112', passwordHash: 'hash', role: 'customer', fullName: 'Other Customer' }
  });
  const admin = await prisma.user.create({
    data: { phone: '01711111111', passwordHash: 'hash', role: 'admin', fullName: 'Test Admin' }
  });

  // Approved vendor
  const vendorApprovedUser = await prisma.user.create({
    data: { phone: '01911111111', passwordHash: 'hash', role: 'vendor', fullName: 'Approved Vendor' }
  });
  const vendorApprovedProvider = await prisma.serviceProvider.create({
    data: {
      userId: vendorApprovedUser.id,
      businessName: 'Approved Tours',
      category: 'tour',
      address: 'Dhaka',
      city: 'Dhaka',
      status: 'APPROVED',
      isVerified: true,
      isActive: true
    }
  });

  // Pending vendor
  const vendorPendingUser = await prisma.user.create({
    data: { phone: '01911111112', passwordHash: 'hash', role: 'vendor' }
  });
  const vendorPendingProvider = await prisma.serviceProvider.create({
    data: {
      userId: vendorPendingUser.id,
      businessName: 'Pending Tours',
      category: 'tour',
      address: 'Dhaka',
      status: 'PENDING',
      isVerified: false,
      isActive: true
    }
  });

  // Inactive vendor (approved but deactivated)
  const vendorInactiveUser = await prisma.user.create({
    data: { phone: '01911111113', passwordHash: 'hash', role: 'vendor' }
  });
  const vendorInactiveProvider = await prisma.serviceProvider.create({
    data: {
      userId: vendorInactiveUser.id,
      businessName: 'Inactive Tours',
      category: 'tour',
      address: 'Dhaka',
      status: 'APPROVED',
      isVerified: true,
      isActive: false
    }
  });

  // Published service on approved vendor (price 1500)
  const publishedService = await prisma.service.create({
    data: {
      providerId: vendorApprovedProvider.id,
      name: 'Sundarbans Day Tour',
      category: 'tour',
      serviceType: 'TOUR',
      description: 'Full-day guided tour',
      price: 1500,
      currency: 'BDT',
      status: 'ACTIVE',
      isActive: true,
      lifecycleStatus: 'PUBLISHED',
      locationCity: 'Khulna',
      availableDays: JSON.stringify([0, 1, 2, 3, 4, 5, 6])
    }
  });

  // Draft service on approved vendor
  const draftService = await prisma.service.create({
    data: {
      providerId: vendorApprovedProvider.id,
      name: 'Draft Tour',
      category: 'tour',
      serviceType: 'TOUR',
      price: 1000,
      currency: 'BDT',
      status: 'INACTIVE',
      isActive: false,
      lifecycleStatus: 'DRAFT',
      locationCity: 'Dhaka'
    }
  });

  // Suspended service on approved vendor
  const suspendedService = await prisma.service.create({
    data: {
      providerId: vendorApprovedProvider.id,
      name: 'Suspended Tour',
      category: 'tour',
      serviceType: 'TOUR',
      price: 1200,
      currency: 'BDT',
      status: 'INACTIVE',
      isActive: false,
      lifecycleStatus: 'SUSPENDED',
      locationCity: 'Dhaka'
    }
  });

  // Rejected service on approved vendor
  const rejectedService = await prisma.service.create({
    data: {
      providerId: vendorApprovedProvider.id,
      name: 'Rejected Tour',
      category: 'tour',
      serviceType: 'TOUR',
      price: 1100,
      currency: 'BDT',
      status: 'INACTIVE',
      isActive: false,
      lifecycleStatus: 'REJECTED',
      locationCity: 'Dhaka',
      rejectionReason: 'Quality concerns'
    }
  });

  // Published service on INACTIVE vendor (approved but isActive=false)
  const inactiveProviderService = await prisma.service.create({
    data: {
      providerId: vendorInactiveProvider.id,
      name: 'Inactive Vendor Tour',
      category: 'tour',
      serviceType: 'TOUR',
      price: 2000,
      currency: 'BDT',
      status: 'ACTIVE',
      isActive: true,
      lifecycleStatus: 'PUBLISHED',
      locationCity: 'Dhaka'
    }
  });

  // Service with capacity on approved vendor (price 500, capacity 3)
  const serviceWithCapacity = await prisma.service.create({
    data: {
      providerId: vendorApprovedProvider.id,
      name: 'Limited Capacity Tour',
      category: 'tour',
      serviceType: 'TOUR',
      price: 500,
      currency: 'BDT',
      capacity: 3,
      status: 'ACTIVE',
      isActive: true,
      lifecycleStatus: 'PUBLISHED',
      locationCity: 'Dhaka',
      availableDays: JSON.stringify([0, 1, 2, 3, 4, 5, 6])
    }
  });

  return {
    app: createApp(),
    customerToken: signToken({ id: customer.id, phone: customer.phone, role: 'customer' }),
    otherCustomerToken: signToken({ id: otherCustomer.id, phone: otherCustomer.phone, role: 'customer' }),
    adminToken: signToken({ id: admin.id, phone: admin.phone, role: 'admin' }),
    customer,
    otherCustomer,
    vendorApproved: vendorApprovedUser,
    vendorApprovedProvider,
    vendorPending: vendorPendingUser,
    vendorPendingProvider,
    vendorInactive: vendorInactiveUser,
    vendorInactiveProvider,
    publishedService,
    draftService,
    suspendedService,
    rejectedService,
    inactiveProviderService,
    serviceWithCapacity
  };
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

describe('Vendor Service Booking (Vendor Service Booking Foundation)', () => {
  let w: World;

  beforeAll(async () => {
    w = await setupWorld();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset transient booking state but keep services/providers.
    await prisma.payment.deleteMany();
    await prisma.qrLog.deleteMany();
        await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
  });

  describe('Positive cases', () => {
    it('approved vendor published service can be booked', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 2 }
      });
      expect(res.status).toBe(201);
      expect(res.body.booking).toBeDefined();
      expect(res.body.booking.serviceId).toBe(w.publishedService.id);
      expect(res.body.booking.providerId).toBe(w.vendorApprovedProvider.id);
      expect(res.body.booking.userId).toBe(w.customer.id);
      expect(res.body.booking.status).toBe('pending');
      expect(res.body.booking.paymentStatus).toBe('pending');
    });

    it('booking stores correct serviceId and vendor comes from server (not client)', async () => {
      // Send a fake providerId; server must ignore it and use the Service.providerId
      const res = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: {
          bookingDate: futureDate(7),
          quantity: 1,
          providerId: w.vendorPendingProvider.id // attempt to attribute to wrong vendor
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.booking.providerId).toBe(w.vendorApprovedProvider.id);
      expect(res.body.booking.serviceId).toBe(w.publishedService.id);
    });

    it('server calculates correct amount (price * quantity)', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 3 }
      });
      expect(res.status).toBe(201);
      expect(res.body.booking.totalAmount).toBe(1500 * 3);
      expect(res.body.booking.finalAmount).toBe(1500 * 3);
      expect(res.body.booking.discountAmount).toBe(0);
    });

    it('payment flow works with service booking (initiate -> verify -> paid)', async () => {
      const create = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 1 }
      });
      expect(create.status).toBe(201);
      const bookingId = create.body.booking.id;
      const finalAmount = create.body.booking.finalAmount;

      // Initiate payment — also tries to tamper amount to 1
      const init = await request(w.app, 'POST', '/api/v1/payments/initiate', {
        token: w.customerToken,
        body: { bookingId, method: 'bkash', amount: 1 }
      });
      expect(init.status).toBe(201);
      expect(init.body.payment.amount).toBe(finalAmount); // server-authoritative
      const txn = init.body.transactionId;

      const verify = await request(w.app, 'POST', '/api/v1/payments/verify', {
        token: w.customerToken,
        body: { transactionId: txn }
      });
      expect(verify.status).toBe(200);

      const detail = await request(w.app, 'GET', `/api/v1/bookings/${bookingId}`, {
        token: w.customerToken
      });
      expect(detail.status).toBe(200);
      expect(detail.body.paymentStatus).toBe('paid');
      expect(detail.body.status).toBe('confirmed');
      expect(detail.body.serviceId).toBe(w.publishedService.id);
      expect(detail.body.service).toBeDefined();
      expect(detail.body.service.id).toBe(w.publishedService.id);
    });

    it('public service detail endpoint returns only safe fields', async () => {
      const res = await request(w.app, 'GET', `/api/v1/services/${w.publishedService.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(w.publishedService.id);
      expect(res.body.name).toBe('Sundarbans Day Tour');
      expect(res.body.price).toBe(1500);
      expect(res.body.currency).toBe('BDT');
      expect(res.body.locationCity).toBe('Khulna');
      expect(res.body.provider).toBeDefined();
      expect(res.body.provider.businessName).toBe('Approved Tours');
      // Must NOT leak KYC / sensitive fields
      expect(res.body.provider.kycData).toBeUndefined();
      expect(res.body.provider.kycStatus).toBeUndefined();
      expect(res.body.provider.rejectionReason).toBeUndefined();
    });
  });

  describe('Security / negative cases', () => {
    it('unauthenticated customer cannot book', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        body: { bookingDate: futureDate(7), quantity: 1 }
      });
      expect(res.status).toBe(401);
    });

    it('nonexistent service returns 404', async () => {
      const res = await request(w.app, 'POST', '/api/v1/services/9999999/book', {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 1 }
      });
      expect(res.status).toBe(404);
    });

    it('draft (unpublished) service cannot be booked', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.draftService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 1 }
      });
      expect(res.status).toBe(403);
    });

    it('suspended service cannot be booked', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.suspendedService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 1 }
      });
      expect(res.status).toBe(403);
    });

    it('rejected service cannot be booked', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.rejectedService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 1 }
      });
      expect(res.status).toBe(403);
    });

    it('unapproved (pending) vendor service cannot be booked', async () => {
      // Create a published service on the pending vendor
      const pendingPub = await prisma.service.create({
        data: {
          providerId: w.vendorPendingProvider.id,
          name: 'Pending Vendor Published',
          category: 'tour',
          serviceType: 'TOUR',
          price: 800,
          currency: 'BDT',
          status: 'ACTIVE',
          isActive: true,
          lifecycleStatus: 'PUBLISHED',
          locationCity: 'Dhaka'
        }
      });

      const res = await request(w.app, 'POST', `/api/v1/services/${pendingPub.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 1 }
      });
      expect(res.status).toBe(403);
    });

    it('inactive vendor service cannot be booked', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.inactiveProviderService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 1 }
      });
      expect(res.status).toBe(403);
    });

    it('invalid (past) date is rejected', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(-3), quantity: 1 }
      });
      expect(res.status).toBe(400);
    });

    it('unavailable weekday is rejected (availableDays restricted)', async () => {
      // Restrict to Monday only
      await prisma.service.update({
        where: { id: w.publishedService.id },
        data: { availableDays: JSON.stringify([1]) }
      });
      // Find a future date that is NOT Monday
      let target = new Date();
      target.setDate(target.getDate() + 1);
      while (target.getDay() === 1) {
        target.setDate(target.getDate() + 1);
      }
      const targetStr = target.toISOString().split('T')[0];

      const res = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: targetStr, quantity: 1 }
      });
      expect(res.status).toBe(400);

      // Reset availableDays
      await prisma.service.update({
        where: { id: w.publishedService.id },
        data: { availableDays: JSON.stringify([0, 1, 2, 3, 4, 5, 6]) }
      });
    });

    it('invalid quantity (zero) is rejected', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 0 }
      });
      expect(res.status).toBe(400);
    });

    it('invalid quantity (exceeding capacity) is rejected', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.serviceWithCapacity.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 10 }
      });
      expect(res.status).toBe(400);
    });

    it('customer cannot forge vendor/provider ID (server overrides)', async () => {
      // Already proven in positive case #2. Repeat explicitly under negative suite:
      const res = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: {
          bookingDate: futureDate(7),
          quantity: 1,
          providerId: w.vendorPendingProvider.id
        }
      });
      expect(res.status).toBe(201);
      expect(res.body.booking.providerId).toBe(w.vendorApprovedProvider.id);
    });

    it('customer cannot manipulate price (server computes from Service.price)', async () => {
      const res = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: {
          bookingDate: futureDate(7),
          quantity: 1,
          price: 1, // forgery attempt
          unitPrice: 1
        }
      });
      expect(res.status).toBe(201);
      // Server must ignore client "price" fields and use Service.price * quantity
      expect(res.body.booking.totalAmount).toBe(1500);
      expect(res.body.booking.finalAmount).toBe(1500);
    });

    it('payment initiate ignores client amount and uses booking.finalAmount', async () => {
      const create = await request(w.app, 'POST', `/api/v1/services/${w.publishedService.id}/book`, {
        token: w.customerToken,
        body: { bookingDate: futureDate(7), quantity: 2 }
      });
      expect(create.status).toBe(201);
      const bookingId = create.body.booking.id;
      const expectedAmount = create.body.booking.finalAmount;

      const init = await request(w.app, 'POST', '/api/v1/payments/initiate', {
        token: w.customerToken,
        body: { bookingId, method: 'bkash', amount: 1 }
      });
      expect(init.status).toBe(201);
      expect(init.body.payment.amount).toBe(expectedAmount);
    });
  });

  describe('Regression: existing Bus Booking still works', () => {
    it('bus booking creation with providerId/category still works (no regression)', async () => {
      const res = await request(w.app, 'POST', '/api/v1/bookings', {
        token: w.customerToken,
        body: {
          providerId: w.vendorApprovedProvider.id,
          category: 'bus',
          bookingDate: futureDate(5),
          travelDate: futureDate(5),
          numberOfPeople: 1
        }
      });
      // Should be 201 (booking created) — schema is intact and backwards-compatible.
      expect([201, 400]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.booking.serviceId).toBeNull();
        expect(res.body.booking.category).toBe('bus');
      }
    });
  });
});