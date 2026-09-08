import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma';
import hotelRoutes from '../src/routes/hotel.routes';
import hotelManageRoutes from '../src/routes/hotel-manage.routes';
import hotelRoomRoutes from '../src/routes/hotel-room.routes';
import hotelBookingRoutes from '../src/routes/hotel-booking.routes';
import hotelOperationsRoutes from '../src/routes/hotel-operations.routes';
import qrRoutes from '../src/routes/qr.routes';
import paymentRoutes from '../src/routes/payment.routes';
import bookingRoutes from '../src/routes/booking.routes';
import { generateHmacSignature, generateTravelPassToken } from '../src/utils/qr';

function signToken(payload: { id: number; phone: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test', { expiresIn: '2h' });
}

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hotels', hotelRoutes);
  app.use('/api/v1/hotels', hotelManageRoutes);
  app.use('/api/v1/hotel-rooms', hotelRoomRoutes);
  app.use('/api/v1/hotel-bookings', hotelBookingRoutes);
  app.use('/api/v1/hotels', hotelOperationsRoutes);
  app.use('/api/v1/qr', qrRoutes);
  app.use('/api/v1/travel-passes', qrRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
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

async function cleanup() {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.hotelMaintenanceRequest.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.hotelStaff.deleteMany();
  await prisma.hotelTax.deleteMany();
  await prisma.hotelImage.deleteMany();
  await prisma.hotelAmenity.deleteMany();
  await prisma.hotelPolicy.deleteMany();
  await prisma.hotelPromotion.deleteMany();
  await prisma.hotelAvailability.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.session.deleteMany();
  await prisma.serviceAvailability.deleteMany();
  await prisma.service.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.busTrip.deleteMany();
  await prisma.busRoute.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.room.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
}

async function setupWorld() {
  const vA = await prisma.user.create({ data: { phone: '01811111111', passwordHash: 'h', role: 'vendor' } });
  const hA = await prisma.serviceProvider.create({
    data: {
      userId: vA.id, businessName: 'Hotel Alpha', category: 'hotel', address: 'Road 1', city: 'Dhaka',
      status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
    }
  });
  const roomA = await prisma.room.create({
    data: {
      providerId: hA.id, name: 'Deluxe Suite', type: 'DELUXE', price: 3000,
      capacity: 2, adultCapacity: 2, childCapacity: 1, totalRooms: 1, roomNumber: '101',
      isAvailable: true, baseCurrency: 'BDT', status: 'ACTIVE'
    }
  });

  const vB = await prisma.user.create({ data: { phone: '01822222222', passwordHash: 'h', role: 'vendor' } });
  const hB = await prisma.serviceProvider.create({
    data: {
      userId: vB.id, businessName: 'Hotel Beta', category: 'hotel', address: 'Road 2', city: 'Chittagong',
      status: 'APPROVED', isVerified: true, isActive: true, isPublished: true, lifecycleStatus: 'APPROVED'
    }
  });
  const roomB = await prisma.room.create({
    data: {
      providerId: hB.id, name: 'Executive Suite', type: 'EXECUTIVE', price: 5000,
      capacity: 3, adultCapacity: 2, childCapacity: 1, totalRooms: 1, roomNumber: '201',
      isAvailable: true, baseCurrency: 'BDT', status: 'ACTIVE'
    }
  });

  const customer = await prisma.user.create({ data: { fullName: 'Rahim Ahmed', phone: '01833333333', passwordHash: 'h', role: 'customer' } });
  const admin = await prisma.user.create({ data: { fullName: 'System Admin', phone: '01844444444', passwordHash: 'h', role: 'admin' } });
  const staffUser = await prisma.user.create({ data: { fullName: 'Staff Karim', phone: '01855555555', passwordHash: 'h', role: 'customer' } });

  return { vA, hA, roomA, vB, hB, roomB, customer, admin, staffUser };
}

describe('STEP 5 — Hotel Operations, Check-in/out, Housekeeping, Maintenance, Staff, Dashboard & QR', () => {
  jest.setTimeout(30000);
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await cleanup(); });

  // =====================================================================
  // 1. ROOM OPERATIONAL STATUS
  // =====================================================================
  describe('Room Operational Status', () => {
    it('sets room operational status to CLEANING, MAINTENANCE, OUT_OF_SERVICE and ACTIVE', async () => {
      const { vA, roomA } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      // 1. Set to MAINTENANCE with notes -> should create maintenance request & mark unavailable
      const resMaint = await request_(app, 'POST', `/api/v1/hotels/rooms/${roomA.id}/operational-status`, {
        token: tvA,
        body: { status: 'MAINTENANCE', notes: 'AC repair needed in room 101' }
      });
      expect(resMaint.status).toBe(200);
      expect(resMaint.body.room.status).toBe('MAINTENANCE');
      expect(resMaint.body.room.isAvailable).toBe(false);

      const maintReq = await prisma.hotelMaintenanceRequest.findFirst({
        where: { roomId: roomA.id }
      });
      expect(maintReq).toBeDefined();
      expect(maintReq?.status).toBe('IN_PROGRESS');
      expect(maintReq?.description).toBe('AC repair needed in room 101');

      // 2. Set to ACTIVE -> should restore isAvailable to true
      const resActive = await request_(app, 'POST', `/api/v1/hotels/rooms/${roomA.id}/operational-status`, {
        token: tvA,
        body: { status: 'ACTIVE' }
      });
      expect(resActive.status).toBe(200);
      expect(resActive.body.room.status).toBe('ACTIVE');
      expect(resActive.body.room.isAvailable).toBe(true);
    });

    it('rejects setting OCCUPIED room directly to ACTIVE without checkout', async () => {
      const { vA, roomA } = await setupWorld();
      await prisma.room.update({ where: { id: roomA.id }, data: { status: 'OCCUPIED' } });
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const res = await request_(app, 'POST', `/api/v1/hotels/rooms/${roomA.id}/operational-status`, {
        token: tvA,
        body: { status: 'ACTIVE' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('occupied');
    });

    it('IDOR: Vendor B cannot change operational status of Vendor A room', async () => {
      const { vB, roomA } = await setupWorld();
      const tvB = signToken({ id: vB.id, phone: vB.phone, role: 'vendor' });
      const app = createApp();

      const res = await request_(app, 'POST', `/api/v1/hotels/rooms/${roomA.id}/operational-status`, {
        token: tvB,
        body: { status: 'MAINTENANCE' }
      });
      expect(res.status).toBe(403);
    });

    it('Customer cannot change room operational status', async () => {
      const { customer, roomA } = await setupWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const app = createApp();

      const res = await request_(app, 'POST', `/api/v1/hotels/rooms/${roomA.id}/operational-status`, {
        token: tc,
        body: { status: 'ACTIVE' }
      });
      expect(res.status).toBe(403);
    });
  });

  // =====================================================================
  // 2. CHECK-IN
  // =====================================================================
  describe('Check-in Lifecycle', () => {
    it('valid paid booking checks in successfully -> room becomes OCCUPIED and checkedInAt set', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 2);

      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-CHK-01',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: tomorrow,
          numberOfPeople: 2,
          numberOfRooms: 1,
          totalAmount: 6000,
          finalAmount: 6000,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-in', {
        token: tvA,
        body: { bookingId: booking.id }
      });

      expect(res.status).toBe(200);
      expect(res.body.booking.checkedInAt).toBeDefined();

      const updatedRoom = await prisma.room.findUnique({ where: { id: roomA.id } });
      expect(updatedRoom?.status).toBe('OCCUPIED');

      const qrLog = await prisma.qrLog.findFirst({ where: { bookingId: booking.id } });
      expect(qrLog).toBeDefined();
      expect(qrLog?.discountType).toBe('hotel_checkin');
    });

    it('rejects check-in for unpaid booking', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-UNPAID',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-in', {
        token: tvA,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('payment not confirmed');
    });

    it('rejects check-in for cancelled booking', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-CANCELLED',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'cancelled',
          paymentStatus: 'paid'
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-in', {
        token: tvA,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cancelled');
    });

    it('rejects duplicate check-in', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-DUP-CHK',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid',
          checkedInAt: new Date()
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-in', {
        token: tvA,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already checked in');
    });

    it('IDOR: Vendor B cannot check in Vendor A booking', async () => {
      const { vB, hA, roomA, customer } = await setupWorld();
      const tvB = signToken({ id: vB.id, phone: vB.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-IDOR-CHK',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-in', {
        token: tvB,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(403);
    });

    it('customer role cannot perform check-in endpoint', async () => {
      const { customer, hA, roomA } = await setupWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-CUST-CHK',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-in', {
        token: tc,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(403);
    });

    it('check-in via valid QR payload succeeds', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const token = generateTravelPassToken();
      const bookingCode = 'BKG-QR-CHK-99';

      const booking = await prisma.booking.create({
        data: {
          bookingCode,
          qrToken: token,
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });

      const payload = {
        tp: token,
        bkg: bookingCode,
        prv: hA.id,
        category: 'hotel',
        valid_from: today.toISOString().split('T')[0],
        valid_until: new Date(today.getTime() + 5 * 86400000).toISOString().split('T')[0],
        discounts: [{ type: 'combo', provider: `PRV-${hA.id}`, value: 0, unit: 'BDT' }]
      };
      const signature = generateHmacSignature(payload);
      const qrData = { payload, signature };

      const res = await request_(app, 'POST', '/api/v1/hotels/check-in', {
        token: tvA,
        body: { qrData }
      });
      expect(res.status).toBe(200);
      expect(res.body.booking.checkedInAt).toBeDefined();
    });

    it('check-in via forged QR payload is rejected', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const payload = {
        tp: 'fake-token',
        bkg: 'BKG-FAKE',
        prv: hA.id,
        category: 'hotel'
      };
      const qrData = { payload, signature: 'bad-signature' };

      const res = await request_(app, 'POST', '/api/v1/hotels/check-in', {
        token: tvA,
        body: { qrData }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('HMAC');
    });
  });

  // =====================================================================
  // 3. CHECK-OUT
  // =====================================================================
  describe('Check-out Lifecycle', () => {
    it('valid checked-in booking checks out successfully -> room becomes CLEANING and housekeeping created', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.room.update({ where: { id: roomA.id }, data: { status: 'OCCUPIED' } });

      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-OUT-01',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid',
          checkedInAt: new Date()
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-out', {
        token: tvA,
        body: { bookingId: booking.id }
      });

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('completed');
      expect(res.body.booking.completedAt).toBeDefined();

      const updatedRoom = await prisma.room.findUnique({ where: { id: roomA.id } });
      expect(updatedRoom?.status).toBe('CLEANING');

      const task = await prisma.housekeepingTask.findFirst({
        where: { roomId: roomA.id, providerId: hA.id }
      });
      expect(task).toBeDefined();
      expect(task?.status).toBe('PENDING');
      expect(task?.notes).toContain('BKG-OUT-01');
    });

    it('rejects check-out before check-in', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-NOT-IN',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid'
          // checkedInAt is null
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-out', {
        token: tvA,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Guest must be checked in before check-out');
    });

    it('rejects duplicate check-out', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-DUP-OUT',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'completed',
          paymentStatus: 'paid',
          checkedInAt: new Date(),
          completedAt: new Date()
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-out', {
        token: tvA,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already checked out');
    });

    it('IDOR: Vendor B cannot check out Vendor A booking', async () => {
      const { vB, hA, roomA, customer } = await setupWorld();
      const tvB = signToken({ id: vB.id, phone: vB.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-IDOR-OUT',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid',
          checkedInAt: new Date()
        }
      });

      const res = await request_(app, 'POST', '/api/v1/hotels/check-out', {
        token: tvB,
        body: { bookingId: booking.id }
      });
      expect(res.status).toBe(403);
    });
  });

  // =====================================================================
  // 4. HOUSEKEEPING
  // =====================================================================
  describe('Housekeeping Lifecycle & State Transitions', () => {
    it('creates, assigns, updates status, and completes housekeeping task -> room restores to ACTIVE', async () => {
      const { vA, hA, roomA, staffUser } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      // Register staffKarim as staff for Hotel Alpha
      await prisma.hotelStaff.create({
        data: { providerId: hA.id, userId: staffUser.id, role: 'HOUSEKEEPING', isActive: true }
      });
      await prisma.room.update({ where: { id: roomA.id }, data: { status: 'CLEANING' } });

      // 1. Create task
      const createRes = await request_(app, 'POST', '/api/v1/hotels/housekeeping', {
        token: tvA,
        body: { providerId: hA.id, roomId: roomA.id, notes: 'Full room cleaning needed' }
      });
      expect(createRes.status).toBe(201);
      const taskId = createRes.body.task.id;
      expect(createRes.body.task.status).toBe('PENDING');

      // 2. List tasks
      const listRes = await request_(app, 'GET', '/api/v1/hotels/housekeeping', { token: tvA });
      expect(listRes.status).toBe(200);
      expect(listRes.body.count).toBe(1);

      // 3. Assign task to staffKarim
      const assignRes = await request_(app, 'PATCH', `/api/v1/hotels/housekeeping/${taskId}`, {
        token: tvA,
        body: { status: 'ASSIGNED', assignedTo: staffUser.id }
      });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.task.status).toBe('ASSIGNED');
      expect(assignRes.body.task.assignedTo).toBe(staffUser.id);

      // 4. In Progress
      const progRes = await request_(app, 'PATCH', `/api/v1/hotels/housekeeping/${taskId}`, {
        token: tvA,
        body: { status: 'IN_PROGRESS' }
      });
      expect(progRes.status).toBe(200);
      expect(progRes.body.task.status).toBe('IN_PROGRESS');

      // 5. Complete task -> room status should become ACTIVE
      const compRes = await request_(app, 'PATCH', `/api/v1/hotels/housekeeping/${taskId}`, {
        token: tvA,
        body: { status: 'COMPLETED' }
      });
      expect(compRes.status).toBe(200);
      expect(compRes.body.task.status).toBe('COMPLETED');
      expect(compRes.body.task.completedAt).toBeDefined();

      const finalRoom = await prisma.room.findUnique({ where: { id: roomA.id } });
      expect(finalRoom?.status).toBe('ACTIVE');
    });

    it('rejects assigning housekeeping task to non-staff user', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const task = await prisma.housekeepingTask.create({
        data: { providerId: hA.id, roomId: roomA.id, status: 'PENDING' }
      });

      const res = await request_(app, 'PATCH', `/api/v1/hotels/housekeeping/${task.id}`, {
        token: tvA,
        body: { assignedTo: customer.id }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not active staff');
    });

    it('rejects invalid state transition on completed housekeeping task', async () => {
      const { vA, hA, roomA } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const task = await prisma.housekeepingTask.create({
        data: { providerId: hA.id, roomId: roomA.id, status: 'COMPLETED', completedAt: new Date() }
      });

      const res = await request_(app, 'PATCH', `/api/v1/hotels/housekeeping/${task.id}`, {
        token: tvA,
        body: { status: 'IN_PROGRESS' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot modify a completed task');
    });

    it('cancelling a housekeeping task works and prevents re-cancelling', async () => {
      const { vA, hA, roomA } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const task = await prisma.housekeepingTask.create({
        data: { providerId: hA.id, roomId: roomA.id, status: 'PENDING' }
      });

      const res = await request_(app, 'POST', `/api/v1/hotels/housekeeping/${task.id}/cancel`, { token: tvA });
      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('CANCELLED');

      const res2 = await request_(app, 'POST', `/api/v1/hotels/housekeeping/${task.id}/cancel`, { token: tvA });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('already cancelled');
    });

    it('IDOR: Vendor B cannot modify Vendor A housekeeping task', async () => {
      const { vB, hA, roomA } = await setupWorld();
      const tvB = signToken({ id: vB.id, phone: vB.phone, role: 'vendor' });
      const app = createApp();

      const task = await prisma.housekeepingTask.create({
        data: { providerId: hA.id, roomId: roomA.id, status: 'PENDING' }
      });

      const resPatch = await request_(app, 'PATCH', `/api/v1/hotels/housekeeping/${task.id}`, {
        token: tvB,
        body: { status: 'IN_PROGRESS' }
      });
      expect(resPatch.status).toBe(403);

      const resCancel = await request_(app, 'POST', `/api/v1/hotels/housekeeping/${task.id}/cancel`, {
        token: tvB
      });
      expect(resCancel.status).toBe(403);
    });
  });

  // =====================================================================
  // 5. MAINTENANCE
  // =====================================================================
  describe('Maintenance Lifecycle & State Transitions', () => {
    it('creates, updates, and resolves maintenance request', async () => {
      const { vA, hA, roomA } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      // 1. Create request
      const createRes = await request_(app, 'POST', '/api/v1/hotels/maintenance', {
        token: tvA,
        body: { providerId: hA.id, roomId: roomA.id, title: 'Broken Showerhead', category: 'PLUMBING' }
      });
      expect(createRes.status).toBe(201);
      const reqId = createRes.body.request.id;
      expect(createRes.body.request.status).toBe('REPORTED');

      // 2. List requests
      const listRes = await request_(app, 'GET', '/api/v1/hotels/maintenance', { token: tvA });
      expect(listRes.status).toBe(200);
      expect(listRes.body.count).toBe(1);

      // 3. Assign & In Progress
      const updateRes = await request_(app, 'PATCH', `/api/v1/hotels/maintenance/${reqId}`, {
        token: tvA,
        body: { status: 'IN_PROGRESS', assignedTo: 'Plumber John' }
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.request.status).toBe('IN_PROGRESS');

      // 4. Resolve request
      const resolveRes = await request_(app, 'PATCH', `/api/v1/hotels/maintenance/${reqId}`, {
        token: tvA,
        body: { status: 'RESOLVED' }
      });
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.request.status).toBe('RESOLVED');
      expect(resolveRes.body.request.resolvedAt).toBeDefined();
    });

    it('rejects modification of resolved maintenance request', async () => {
      const { vA, hA } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const req = await prisma.hotelMaintenanceRequest.create({
        data: { providerId: hA.id, title: 'Fixed Lights', status: 'RESOLVED', resolvedAt: new Date() }
      });

      const res = await request_(app, 'PATCH', `/api/v1/hotels/maintenance/${req.id}`, {
        token: tvA,
        body: { status: 'IN_PROGRESS' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot modify a resolved request');
    });

    it('cancels maintenance request and rejects re-cancelling', async () => {
      const { vA, hA } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const req = await prisma.hotelMaintenanceRequest.create({
        data: { providerId: hA.id, title: 'Temporary issue', status: 'REPORTED' }
      });

      const res = await request_(app, 'POST', `/api/v1/hotels/maintenance/${req.id}/cancel`, { token: tvA });
      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('CANCELLED');

      const res2 = await request_(app, 'POST', `/api/v1/hotels/maintenance/${req.id}/cancel`, { token: tvA });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('already cancelled');
    });

    it('IDOR: Vendor B cannot modify or cancel Vendor A maintenance request', async () => {
      const { vB, hA } = await setupWorld();
      const tvB = signToken({ id: vB.id, phone: vB.phone, role: 'vendor' });
      const app = createApp();

      const req = await prisma.hotelMaintenanceRequest.create({
        data: { providerId: hA.id, title: 'HVAC repair', status: 'REPORTED' }
      });

      const resPatch = await request_(app, 'PATCH', `/api/v1/hotels/maintenance/${req.id}`, {
        token: tvB,
        body: { status: 'IN_PROGRESS' }
      });
      expect(resPatch.status).toBe(403);

      const resCancel = await request_(app, 'POST', `/api/v1/hotels/maintenance/${req.id}/cancel`, {
        token: tvB
      });
      expect(resCancel.status).toBe(403);
    });
  });

  // =====================================================================
  // 6. HOTEL STAFF
  // =====================================================================
  describe('Hotel Staff Management', () => {
    it('adds, lists, updates, and deactivates hotel staff', async () => {
      const { vA, hA, staffUser } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      // 1. Add staff
      const addRes = await request_(app, 'POST', '/api/v1/hotels/staff', {
        token: tvA,
        body: { providerId: hA.id, userId: staffUser.id, role: 'RECEPTIONIST' }
      });
      expect(addRes.status).toBe(201);
      const staffId = addRes.body.staff.id;

      // 2. List staff
      const listRes = await request_(app, 'GET', '/api/v1/hotels/staff', { token: tvA });
      expect(listRes.status).toBe(200);
      expect(listRes.body.count).toBe(1);
      expect(listRes.body.staff[0].user.fullName).toBe('Staff Karim');

      // 3. Update staff role
      const updateRes = await request_(app, 'PATCH', `/api/v1/hotels/staff/${staffId}`, {
        token: tvA,
        body: { role: 'MANAGER' }
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.staff.role).toBe('MANAGER');

      // 4. Deactivate staff
      const delRes = await request_(app, 'DELETE', `/api/v1/hotels/staff/${staffId}`, { token: tvA });
      expect(delRes.status).toBe(200);

      // Verify no longer listed in active staff
      const listAfter = await request_(app, 'GET', '/api/v1/hotels/staff', { token: tvA });
      expect(listAfter.body.count).toBe(0);
    });

    it('rejects adding admin user as hotel staff', async () => {
      const { vA, hA, admin } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const res = await request_(app, 'POST', '/api/v1/hotels/staff', {
        token: tvA,
        body: { providerId: hA.id, userId: admin.id, role: 'RECEPTIONIST' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot assign admin users');
    });

    it('IDOR: Vendor B cannot manage Vendor A staff', async () => {
      const { vB, hA, staffUser } = await setupWorld();
      const tvB = signToken({ id: vB.id, phone: vB.phone, role: 'vendor' });
      const app = createApp();

      const staff = await prisma.hotelStaff.create({
        data: { providerId: hA.id, userId: staffUser.id, role: 'RECEPTIONIST' }
      });

      const resPatch = await request_(app, 'PATCH', `/api/v1/hotels/staff/${staff.id}`, {
        token: tvB,
        body: { role: 'MANAGER' }
      });
      expect(resPatch.status).toBe(403);

      const resDel = await request_(app, 'DELETE', `/api/v1/hotels/staff/${staff.id}`, {
        token: tvB
      });
      expect(resDel.status).toBe(403);
    });
  });

  // =====================================================================
  // 7. OPERATIONAL DASHBOARD & MULTI-TENANT ISOLATION
  // =====================================================================
  describe('Operational Dashboard & Multi-Tenant Isolation', () => {
    it('isolates dashboard data strictly between Vendor A and Vendor B', async () => {
      const { vA, hA, roomA, vB, hB, roomB, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const tvB = signToken({ id: vB.id, phone: vB.phone, role: 'vendor' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create Booking for Hotel A: Arrival today, checked in
      await prisma.booking.create({
        data: {
          bookingCode: 'BKG-A-TODAY',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: tomorrow,
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid',
          checkedInAt: new Date()
        }
      });

      // Create Booking for Hotel B: Arrival tomorrow
      await prisma.booking.create({
        data: {
          bookingCode: 'BKG-B-TMRW',
          userId: customer.id,
          providerId: hB.id,
          roomId: roomB.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: tomorrow,
          returnDate: new Date(tomorrow.getTime() + 86400000),
          totalAmount: 5000,
          finalAmount: 5000,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });

      // Create Housekeeping for Hotel A
      await prisma.housekeepingTask.create({
        data: { providerId: hA.id, roomId: roomA.id, status: 'PENDING' }
      });

      // Create Maintenance for Hotel B
      await prisma.hotelMaintenanceRequest.create({
        data: { providerId: hB.id, roomId: roomB.id, title: 'Beta AC issue', status: 'REPORTED' }
      });

      // 1. Vendor A arrivals-today should show 1, Vendor B arrivals-today should show 0
      const arrA = await request_(app, 'GET', '/api/v1/hotels/dashboard/arrivals-today', { token: tvA });
      expect(arrA.status).toBe(200);
      expect(arrA.body.count).toBe(1);
      expect(arrA.body.arrivals[0].bookingCode).toBe('BKG-A-TODAY');

      const arrB = await request_(app, 'GET', '/api/v1/hotels/dashboard/arrivals-today', { token: tvB });
      expect(arrB.status).toBe(200);
      expect(arrB.body.count).toBe(0);

      // 2. Current guests: Vendor A has 1, Vendor B has 0
      const guestA = await request_(app, 'GET', '/api/v1/hotels/dashboard/current-guests', { token: tvA });
      expect(guestA.status).toBe(200);
      expect(guestA.body.count).toBe(1);

      const guestB = await request_(app, 'GET', '/api/v1/hotels/dashboard/current-guests', { token: tvB });
      expect(guestB.status).toBe(200);
      expect(guestB.body.count).toBe(0);

      // 3. Housekeeping: Vendor A has 1 pending, Vendor B has 0
      const hkA = await request_(app, 'GET', '/api/v1/hotels/dashboard/housekeeping', { token: tvA });
      expect(hkA.body.pending).toBe(1);

      const hkB = await request_(app, 'GET', '/api/v1/hotels/dashboard/housekeeping', { token: tvB });
      expect(hkB.body.pending).toBe(0);

      // 4. Maintenance: Vendor A has 0 open, Vendor B has 1 open
      const maintA = await request_(app, 'GET', '/api/v1/hotels/dashboard/maintenance', { token: tvA });
      expect(maintA.body.open).toBe(0);

      const maintB = await request_(app, 'GET', '/api/v1/hotels/dashboard/maintenance', { token: tvB });
      expect(maintB.body.open).toBe(1);

      // 5. Rooms status: Vendor A has 1 room, Vendor B has 1 room
      const rmA = await request_(app, 'GET', '/api/v1/hotels/dashboard/rooms-status', { token: tvA });
      expect(rmA.body.total).toBe(1);
      expect(rmA.body.rooms[0].name).toBe('Deluxe Suite');

      const rmB = await request_(app, 'GET', '/api/v1/hotels/dashboard/rooms-status', { token: tvB });
      expect(rmB.body.total).toBe(1);
      expect(rmB.body.rooms[0].name).toBe('Executive Suite');
    });
  });

  // =====================================================================
  // 8. QR & TRAVEL PASS VERIFICATION
  // =====================================================================
  describe('QR & Travel Pass Verification Endpoint', () => {
    it('verifies valid QR, checks in guest, and enforces replay protection', async () => {
      const { vA, hA, roomA, customer } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const tc = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-QR-PASS-1',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });

      // Customer generates QR
      const genRes = await request_(app, 'GET', `/api/v1/qr/generate/${booking.id}`, { token: tc });
      expect(genRes.status).toBe(200);
      expect(genRes.body.qrObject).toBeDefined();

      // Vendor scans QR
      const verifyRes = await request_(app, 'POST', '/api/v1/qr/verify', {
        token: tvA,
        body: { qrData: genRes.body.qrObject }
      });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
      expect(verifyRes.body.bookingCode).toBe('BKG-QR-PASS-1');

      // Booking status checkedInAt should be set
      const bkgAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(bkgAfter?.checkedInAt).toBeDefined();

      // Replay protection: second scan on the same day must be rejected with 409
      const replayRes = await request_(app, 'POST', '/api/v1/qr/verify', {
        token: tvA,
        body: { qrData: genRes.body.qrObject }
      });
      expect(replayRes.status).toBe(409);
      expect(replayRes.body.error).toContain('replay protection');
    });

    it('rejects cross-provider QR scan (Vendor B scanning Hotel A travel pass)', async () => {
      const { vB, hA, roomA, customer } = await setupWorld();
      const tvB = signToken({ id: vB.id, phone: vB.phone, role: 'vendor' });
      const tc = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const app = createApp();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          bookingCode: 'BKG-CROSS-QR',
          userId: customer.id,
          providerId: hA.id,
          roomId: roomA.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: today,
          returnDate: new Date(today.getTime() + 86400000),
          totalAmount: 3000,
          finalAmount: 3000,
          status: 'confirmed',
          paymentStatus: 'paid'
        }
      });

      const genRes = await request_(app, 'GET', `/api/v1/qr/generate/${booking.id}`, { token: tc });
      expect(genRes.status).toBe(200);

      // Vendor B attempts to verify Vendor A's pass
      const verifyRes = await request_(app, 'POST', '/api/v1/qr/verify', {
        token: tvB,
        body: { qrData: genRes.body.qrObject }
      });
      expect(verifyRes.status).toBe(403);
      expect(verifyRes.body.error).toContain('only verify passes for your own business');
    });

    it('rejects malformed QR data', async () => {
      const { vA } = await setupWorld();
      const tvA = signToken({ id: vA.id, phone: vA.phone, role: 'vendor' });
      const app = createApp();

      const res = await request_(app, 'POST', '/api/v1/qr/verify', {
        token: tvA,
        body: { qrData: 'not-valid-json' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid QR JSON format');
    });

    it('rejects customer role from verifying QR', async () => {
      const { customer } = await setupWorld();
      const tc = signToken({ id: customer.id, phone: customer.phone, role: 'customer' });
      const app = createApp();

      const res = await request_(app, 'POST', '/api/v1/qr/verify', {
        token: tc,
        body: { qrData: { payload: {}, signature: 'sig' } }
      });
      expect(res.status).toBe(403);
    });
  });
});
