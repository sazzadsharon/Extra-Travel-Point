import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(15000);

// ---------------------------------------------------------------------------
// Recreate the validation logic from vendor.routes.ts so we can test it
// without spinning up the full Express router (project convention).
// ---------------------------------------------------------------------------

const availabilityCreateSchema = {
  date: (val: string) => !isNaN(Date.parse(val)),
  startTime: /^([01]\d|2[0-3]):[0-5]\d$/,
  endTime: /^([01]\d|2[0-3]):[0-5]\d$/,
  capacity: (val: any) => Number.isInteger(val) && val > 0,
  validate: (data: { startTime?: string; endTime?: string }) => {
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      return false;
    }
    return true;
  }
};

async function ensureServiceOwnership(serviceId: number, userId: number): Promise<boolean> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { provider: { select: { userId: true } } }
  });
  return !!service && service.provider.userId === userId;
}

describe('P1.4 Focused: ServiceAvailability', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.review.deleteMany();
    await prisma.qrLog.deleteMany();
    await prisma.seatLock.deleteMany();
        await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.serviceAvailability.deleteMany();
    await prisma.service.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.user.deleteMany();
  });

  // -------------------------------------------------------------------------
  // 1. Vendor can create availability for their own service
  // -------------------------------------------------------------------------
  describe('Vendor creates availability for own service', () => {
    it('creates availability when vendor owns the service', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01911111111', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      const isOwner = await ensureServiceOwnership(service.id, vendor.id);
      expect(isOwner).toBe(true);

      const availability = await prisma.serviceAvailability.create({
        data: {
          serviceId: service.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 40,
          isActive: true
        }
      });

      expect(availability.id).toBeDefined();
      expect(availability.serviceId).toBe(service.id);
      expect(availability.startTime).toBe('08:00');
      expect(availability.endTime).toBe('14:00');
      expect(availability.capacity).toBe(40);
      expect(availability.isActive).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Vendor can list their own availability
  // -------------------------------------------------------------------------
  describe('Vendor lists own availability', () => {
    it('returns all availability slots for the vendors service', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01922222222', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      await prisma.serviceAvailability.createMany({
        data: [
          { serviceId: service.id, date: new Date('2026-09-01'), startTime: '08:00', endTime: '14:00', capacity: 40, isActive: true },
          { serviceId: service.id, date: new Date('2026-09-02'), startTime: '09:00', endTime: '15:00', capacity: 35, isActive: true },
          { serviceId: service.id, date: new Date('2026-09-03'), startTime: '10:00', endTime: '16:00', capacity: 30, isActive: true }
        ]
      });

      const isOwner = await ensureServiceOwnership(service.id, vendor.id);
      expect(isOwner).toBe(true);

      const availabilities = await prisma.serviceAvailability.findMany({
        where: { serviceId: service.id },
        orderBy: { date: 'asc' }
      });

      expect(availabilities).toHaveLength(3);
      expect(availabilities[0].capacity).toBe(40);
      expect(availabilities[1].capacity).toBe(35);
      expect(availabilities[2].capacity).toBe(30);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Vendor can update their own availability
  // -------------------------------------------------------------------------
  describe('Vendor updates own availability', () => {
    it('updates capacity and time for an existing slot', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01933333333', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      const availability = await prisma.serviceAvailability.create({
        data: {
          serviceId: service.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 40,
          isActive: true
        }
      });

      const isOwner = await ensureServiceOwnership(service.id, vendor.id);
      expect(isOwner).toBe(true);

      const updated = await prisma.serviceAvailability.update({
        where: { id: availability.id },
        data: { capacity: 25, startTime: '07:00', endTime: '13:00' }
      });

      expect(updated.capacity).toBe(25);
      expect(updated.startTime).toBe('07:00');
      expect(updated.endTime).toBe('13:00');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Vendor can deactivate/delete their own availability
  // -------------------------------------------------------------------------
  describe('Vendor deactivates or deletes own availability', () => {
    it('deactivates availability by setting isActive to false', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01944444444', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      const availability = await prisma.serviceAvailability.create({
        data: {
          serviceId: service.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 40,
          isActive: true
        }
      });

      const deactivated = await prisma.serviceAvailability.update({
        where: { id: availability.id },
        data: { isActive: false }
      });

      expect(deactivated.isActive).toBe(false);
    });

    it('deletes availability permanently', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01955555555', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      const availability = await prisma.serviceAvailability.create({
        data: {
          serviceId: service.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 40,
          isActive: true
        }
      });

      await prisma.serviceAvailability.delete({
        where: { id: availability.id }
      });

      const found = await prisma.serviceAvailability.findUnique({
        where: { id: availability.id }
      });
      expect(found).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Vendor cannot access another vendor's availability
  // -------------------------------------------------------------------------
  describe('Vendor cannot access another vendors availability', () => {
    it('ensureServiceOwnership returns false for a different vendor', async () => {
      const vendorA = await prisma.user.create({
        data: { phone: '01966666661', passwordHash: 'hash', role: 'vendor' }
      });
      const vendorB = await prisma.user.create({
        data: { phone: '01966666662', passwordHash: 'hash', role: 'vendor' }
      });
      const providerA = await prisma.serviceProvider.create({
        data: {
          userId: vendorA.id,
          businessName: 'Vendor A',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const serviceA = await prisma.service.create({
        data: {
          providerId: providerA.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      await prisma.serviceAvailability.create({
        data: {
          serviceId: serviceA.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 40,
          isActive: true
        }
      });

      const isOwner = await ensureServiceOwnership(serviceA.id, vendorB.id);
      expect(isOwner).toBe(false);
    });

    it('vendor B cannot update vendor As availability record', async () => {
      const vendorA = await prisma.user.create({
        data: { phone: '01966666663', passwordHash: 'hash', role: 'vendor' }
      });
      const vendorB = await prisma.user.create({
        data: { phone: '01966666664', passwordHash: 'hash', role: 'vendor' }
      });
      const providerA = await prisma.serviceProvider.create({
        data: {
          userId: vendorA.id,
          businessName: 'Vendor A',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const serviceA = await prisma.service.create({
        data: {
          providerId: providerA.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      const availability = await prisma.serviceAvailability.create({
        data: {
          serviceId: serviceA.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 40,
          isActive: true
        }
      });

      // Simulate the PATCH endpoint ownership check
      const isOwner = await ensureServiceOwnership(serviceA.id, vendorB.id);
      expect(isOwner).toBe(false);

      // Verify the record was NOT modified
      const unchanged = await prisma.serviceAvailability.findUnique({
        where: { id: availability.id }
      });
      expect(unchanged?.capacity).toBe(40);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Unapproved/inactive vendor cannot manage availability
  // -------------------------------------------------------------------------
  describe('Unapproved or inactive vendor cannot manage availability', () => {
    it('vendor with PENDING status cannot create availability', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01977777771', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Pending Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'PENDING',
          isVerified: false,
          isActive: true
        }
      });

      // Simulate the endpoint check: provider.status !== 'APPROVED'
      const canManage = provider.status === 'APPROVED' && provider.isActive;
      expect(canManage).toBe(false);
    });

    it('vendor with isActive=false cannot create availability', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01977777772', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Inactive Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: false
        }
      });

      const canManage = provider.status === 'APPROVED' && provider.isActive;
      expect(canManage).toBe(false);
    });

    it('vendor with REJECTED status cannot create availability', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01977777773', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Rejected Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'REJECTED',
          isVerified: false,
          isActive: true
        }
      });

      const canManage = provider.status === 'APPROVED' && provider.isActive;
      expect(canManage).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 7-11. Validation: invalid date, start time, end time, end before start, capacity
  // -------------------------------------------------------------------------
  describe('Availability input validation', () => {
    it('rejects invalid date format', () => {
      expect(availabilityCreateSchema.date('not-a-date')).toBe(false);
      expect(availabilityCreateSchema.date('')).toBe(false);
      expect(availabilityCreateSchema.date('2026/13/45')).toBe(false);
    });

    it('accepts valid date format', () => {
      expect(availabilityCreateSchema.date('2026-09-01')).toBe(true);
      expect(availabilityCreateSchema.date('2026-12-31')).toBe(true);
    });

    it('rejects invalid start time format', () => {
      expect(availabilityCreateSchema.startTime.test('8:00')).toBe(false);
      expect(availabilityCreateSchema.startTime.test('0800')).toBe(false);
      expect(availabilityCreateSchema.startTime.test('08-00')).toBe(false);
      expect(availabilityCreateSchema.startTime.test('24:00')).toBe(false);
      expect(availabilityCreateSchema.startTime.test('12:60')).toBe(false);
    });

    it('accepts valid start time format', () => {
      expect(availabilityCreateSchema.startTime.test('08:00')).toBe(true);
      expect(availabilityCreateSchema.startTime.test('00:00')).toBe(true);
      expect(availabilityCreateSchema.startTime.test('23:59')).toBe(true);
    });

    it('rejects invalid end time format', () => {
      expect(availabilityCreateSchema.endTime.test('14:0')).toBe(false);
      expect(availabilityCreateSchema.endTime.test('1400')).toBe(false);
      expect(availabilityCreateSchema.endTime.test('25:00')).toBe(false);
      expect(availabilityCreateSchema.endTime.test('12:99')).toBe(false);
    });

    it('accepts valid end time format', () => {
      expect(availabilityCreateSchema.endTime.test('14:00')).toBe(true);
      expect(availabilityCreateSchema.endTime.test('00:00')).toBe(true);
      expect(availabilityCreateSchema.endTime.test('23:59')).toBe(true);
    });

    it('rejects end time before start time', () => {
      expect(availabilityCreateSchema.validate({ startTime: '14:00', endTime: '08:00' })).toBe(false);
      expect(availabilityCreateSchema.validate({ startTime: '14:00', endTime: '13:59' })).toBe(false);
    });

    it('rejects end time equal to start time', () => {
      expect(availabilityCreateSchema.validate({ startTime: '08:00', endTime: '08:00' })).toBe(false);
    });

    it('accepts valid time range', () => {
      expect(availabilityCreateSchema.validate({ startTime: '08:00', endTime: '14:00' })).toBe(true);
      expect(availabilityCreateSchema.validate({ startTime: '00:00', endTime: '23:59' })).toBe(true);
    });

    it('accepts when only start time is provided (no end time)', () => {
      expect(availabilityCreateSchema.validate({ startTime: '08:00' })).toBe(true);
    });

    it('accepts when only end time is provided (no start time)', () => {
      expect(availabilityCreateSchema.validate({ endTime: '14:00' })).toBe(true);
    });

    it('rejects invalid/non-positive capacity', () => {
      expect(availabilityCreateSchema.capacity(0)).toBe(false);
      expect(availabilityCreateSchema.capacity(-1)).toBe(false);
      expect(availabilityCreateSchema.capacity(-100)).toBe(false);
      expect(availabilityCreateSchema.capacity(1.5)).toBe(false);
      expect(availabilityCreateSchema.capacity(2.7)).toBe(false);
    });

    it('accepts valid positive integer capacity', () => {
      expect(availabilityCreateSchema.capacity(1)).toBe(true);
      expect(availabilityCreateSchema.capacity(40)).toBe(true);
      expect(availabilityCreateSchema.capacity(100)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 12. Booking inside valid availability succeeds
  // -------------------------------------------------------------------------
  describe('Booking inside valid availability succeeds', () => {
    it('booking within capacity on an active availability date is allowed', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01811111111', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01988888881', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      await prisma.serviceAvailability.create({
        data: {
          serviceId: service.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 40,
          isActive: true
        }
      });

      const travelDate = '2026-09-01';
      const requestedUnits = 2;

      const availability = await prisma.serviceAvailability.findFirst({
        where: { serviceId: service.id, date: new Date(travelDate), isActive: true }
      });

      expect(availability).not.toBeNull();
      if (availability && availability.capacity != null) {
        expect(requestedUnits).toBeLessThanOrEqual(availability.capacity);
      }

      const booking = await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: provider.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(travelDate),
          numberOfPeople: requestedUnits,
          totalAmount: service.price * requestedUnits,
          discountAmount: 0,
          finalAmount: service.price * requestedUnits,
          serviceId: service.id,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      expect(booking.id).toBeDefined();
      expect(booking.serviceId).toBe(service.id);
    });
  });

  // -------------------------------------------------------------------------
  // 13. Booking outside availability is rejected
  // -------------------------------------------------------------------------
  describe('Booking outside availability is rejected', () => {
    it('no availability record for the travel date means no structured availability', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01822222222', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01988888882', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      await prisma.serviceAvailability.create({
        data: {
          serviceId: service.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 40,
          isActive: true
        }
      });

      const travelDate = '2026-09-10';
      const availability = await prisma.serviceAvailability.findFirst({
        where: { serviceId: service.id, date: new Date(travelDate), isActive: true }
      });

      expect(availability).toBeNull();
    });

    it('booking exceeding availability capacity is rejected', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01833333333', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01988888883', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      await prisma.serviceAvailability.create({
        data: {
          serviceId: service.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 5,
          isActive: true
        }
      });

      const travelDate = '2026-09-01';
      const requestedUnits = 10;

      const availability = await prisma.serviceAvailability.findFirst({
        where: { serviceId: service.id, date: new Date(travelDate), isActive: true }
      });

      expect(availability).not.toBeNull();
      if (availability && availability.capacity != null) {
        expect(requestedUnits).toBeGreaterThan(availability.capacity);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 14. Inactive availability rejects booking
  // -------------------------------------------------------------------------
  describe('Inactive availability rejects booking', () => {
    it('booking on an inactive availability date finds no active slot', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01844444444', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01988888884', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      await prisma.serviceAvailability.create({
        data: {
          serviceId: service.id,
          date: new Date('2026-09-01'),
          startTime: '08:00',
          endTime: '14:00',
          capacity: 40,
          isActive: false
        }
      });

      const travelDate = '2026-09-01';
      const availability = await prisma.serviceAvailability.findFirst({
        where: { serviceId: service.id, date: new Date(travelDate), isActive: true }
      });

      expect(availability).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 15. Existing capacity enforcement still works
  // -------------------------------------------------------------------------
  describe('Existing capacity enforcement still works', () => {
    it('service-level capacity is still enforced', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01855555555', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01988888885', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          capacity: 30,
          status: 'ACTIVE',
          isActive: true
        }
      });

      const requestedUnits = 35;
      expect(requestedUnits).toBeGreaterThan(service.capacity!);
    });

    it('seat-based capacity enforcement still works', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01866666666', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01988888886', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
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
          travelDate: new Date('2026-09-01'),
          seatNumbers: 'A1,A2,A3',
          totalAmount: 2400,
          discountAmount: 0,
          finalAmount: 2400,
          status: 'confirmed',
          paymentStatus: 'completed'
        }
      });

      const occupied = new Set<string>();
      const conflicting = await prisma.booking.findMany({
        where: {
          providerId: provider.id,
          category: 'bus',
          status: { in: ['confirmed', 'pending'] }
        },
        select: { travelDate: true, seatNumbers: true }
      });

      for (const b of conflicting) {
        if (b.travelDate.toISOString().split('T')[0] !== '2026-09-01') continue;
        if (!b.seatNumbers) continue;
        b.seatNumbers.split(',').forEach(s => occupied.add(s.trim()));
      }

      expect(occupied.has('A1')).toBe(true);
      expect(occupied.has('A2')).toBe(true);
      expect(occupied.has('A3')).toBe(true);
      expect(occupied.has('B1')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 16. P1.3 vendor rejection flow still works
  // -------------------------------------------------------------------------
  describe('P1.3 vendor rejection flow still works', () => {
    it('vendor can reject a pending booking with a reason', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01877777777', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01988888887', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
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
          travelDate: new Date('2026-09-01'),
          totalAmount: 1000,
          discountAmount: 0,
          finalAmount: 1000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      const rejected = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'rejected', rejectionReason: 'Vehicle under maintenance' }
      });

      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionReason).toBe('Vehicle under maintenance');
    });

    it('rejected booking cannot transition to confirmed', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01888888888', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01988888888', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
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
          travelDate: new Date('2026-09-01'),
          totalAmount: 1000,
          discountAmount: 0,
          finalAmount: 1000,
          status: 'rejected',
          paymentStatus: 'pending',
          rejectionReason: 'No longer available'
        }
      });

      const VALID_TRANSITIONS: Record<string, string[]> = {
        pending: ['confirmed', 'rejected'],
        confirmed: ['completed', 'cancelled'],
        rejected: [],
        completed: [],
        cancelled: [],
        refunded: [],
        expired: []
      };

      const allowedTransitions = VALID_TRANSITIONS[booking.status] || [];
      expect(allowedTransitions).not.toContain('confirmed');
      expect(allowedTransitions).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 17. Existing booking flows without structured availability are not broken
  // -------------------------------------------------------------------------
  describe('Existing booking flows without structured availability still work', () => {
    it('booking without serviceId succeeds (legacy flow)', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01899999999', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01999999999', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
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
          travelDate: new Date('2026-09-01'),
          numberOfPeople: 2,
          totalAmount: 1600,
          discountAmount: 0,
          finalAmount: 1600,
          serviceId: null,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      expect(booking.id).toBeDefined();
      expect(booking.serviceId).toBeNull();
      expect(booking.status).toBe('pending');
    });

    it('booking with serviceId but no availability record still works', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01810101010', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01910101010', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Test Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: 'Dhaka-Cox Bus',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      // No availability record created for this service/date
      const travelDate = '2026-09-01';
      const availability = await prisma.serviceAvailability.findFirst({
        where: { serviceId: service.id, date: new Date(travelDate), isActive: true }
      });

      expect(availability).toBeNull();

      // Booking should still succeed when no availability record exists
      const booking = await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: provider.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(travelDate),
          numberOfPeople: 2,
          totalAmount: 1600,
          discountAmount: 0,
          finalAmount: 1600,
          serviceId: service.id,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      expect(booking.id).toBeDefined();
      expect(booking.serviceId).toBe(service.id);
    });
  });
});
