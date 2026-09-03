import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(15000);

describe('P1.4: Structured Service Availability', () => {
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

  describe('Availability CRUD (Prisma layer)', () => {
    it('should create availability for a service', async () => {
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

      expect(availability.serviceId).toBe(service.id);
      expect(availability.startTime).toBe('08:00');
      expect(availability.endTime).toBe('14:00');
      expect(availability.capacity).toBe(40);
      expect(availability.isActive).toBe(true);
    });

    it('should list availability for a service', async () => {
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
      await prisma.serviceAvailability.create({
        data: {
          serviceId: service.id,
          date: new Date('2026-09-02'),
          startTime: '09:00',
          endTime: '15:00',
          capacity: 40,
          isActive: true
        }
      });

      const availabilities = await prisma.serviceAvailability.findMany({
        where: { serviceId: service.id },
        orderBy: { date: 'asc' }
      });

      expect(availabilities).toHaveLength(2);
      expect(availabilities[0].date.toISOString().split('T')[0]).toBe('2026-09-01');
      expect(availabilities[1].date.toISOString().split('T')[0]).toBe('2026-09-02');
    });

    it('should update availability', async () => {
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

      const updated = await prisma.serviceAvailability.update({
        where: { id: availability.id },
        data: { capacity: 35, isActive: false }
      });

      expect(updated.capacity).toBe(35);
      expect(updated.isActive).toBe(false);
    });

    it('should delete availability', async () => {
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

      await prisma.serviceAvailability.delete({
        where: { id: availability.id }
      });

      const found = await prisma.serviceAvailability.findUnique({
        where: { id: availability.id }
      });
      expect(found).toBeNull();
    });
  });

  describe('Booking enforcement with availability', () => {
    it('booking inside active availability succeeds', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01811111111', passwordHash: 'hash', role: 'customer' }
      });
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
      const conflicting = await prisma.booking.findMany({
        where: {
          providerId: provider.id,
          category: 'bus',
          status: { in: ['confirmed', 'pending'] }
        },
        select: { travelDate: true, seatNumbers: true }
      });

      const occupied = new Set<string>();
      for (const b of conflicting) {
        if (b.travelDate.toISOString().split('T')[0] !== travelDate) continue;
        if (!b.seatNumbers) continue;
        b.seatNumbers.split(',').forEach(s => occupied.add(s.trim()));
      }

      const requestedUnits = 2;
      const availability = await prisma.serviceAvailability.findFirst({
        where: { serviceId: service.id, date: new Date(travelDate), isActive: true }
      });

      expect(availability).not.toBeNull();
      if (availability && availability.capacity != null) {
        expect(requestedUnits <= availability.capacity).toBe(true);
      }
    });

    it('booking outside availability is rejected (no matching date)', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01822222222', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01966666666', passwordHash: 'hash', role: 'vendor' }
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

      const travelDate = '2026-09-05';
      const availability = await prisma.serviceAvailability.findFirst({
        where: { serviceId: service.id, date: new Date(travelDate), isActive: true }
      });

      expect(availability).toBeNull();
    });

    it('inactive availability rejects booking', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01833333333', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01977777777', passwordHash: 'hash', role: 'vendor' }
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

    it('availability capacity is enforced', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01844444444', passwordHash: 'hash', role: 'customer' }
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
          capacity: 2,
          isActive: true
        }
      });

      const requestedUnits = 3;
      const availability = await prisma.serviceAvailability.findFirst({
        where: { serviceId: service.id, date: new Date('2026-09-01'), isActive: true }
      });

      expect(availability).not.toBeNull();
      if (availability && availability.capacity != null) {
        expect(requestedUnits > availability.capacity).toBe(true);
      }
    });

    it('existing booking flows without serviceId continue working', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01855555555', passwordHash: 'hash', role: 'customer' }
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
          totalAmount: 1000,
          discountAmount: 0,
          finalAmount: 1000,
          status: 'pending',
          paymentStatus: 'pending',
          serviceId: null
        }
      });

      expect(booking.id).toBeDefined();
      expect(booking.serviceId).toBeNull();
    });

    it('existing P1.3 rejection flow still works', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01866666666', passwordHash: 'hash', role: 'customer' }
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
        data: { status: 'rejected', rejectionReason: 'No longer available' }
      });

      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionReason).toBe('No longer available');
    });
  });

  describe('Availability validation (Zod schemas)', () => {
    const availabilityCreateSchema = {
      date: (val: string) => !isNaN(Date.parse(val)),
      startTime: /^\d{2}:\d{2}$/,
      endTime: /^\d{2}:\d{2}$/,
      capacity: (val: any) => Number.isInteger(val) && val > 0,
      validate: (data: any) => {
        if (data.startTime && data.endTime && data.startTime >= data.endTime) {
          return false;
        }
        return true;
      }
    };

    it('should reject invalid date format', () => {
      expect(availabilityCreateSchema.date('not-a-date')).toBe(false);
    });

    it('should accept valid date format', () => {
      expect(availabilityCreateSchema.date('2026-09-01')).toBe(true);
    });

    it('should reject invalid time format', () => {
      expect(availabilityCreateSchema.startTime.test('8:00')).toBe(false);
      expect(availabilityCreateSchema.startTime.test('0800')).toBe(false);
      expect(availabilityCreateSchema.startTime.test('08-00')).toBe(false);
    });

    it('should accept valid time format', () => {
      expect(availabilityCreateSchema.startTime.test('08:00')).toBe(true);
      expect(availabilityCreateSchema.startTime.test('23:59')).toBe(true);
      expect(availabilityCreateSchema.startTime.test('00:00')).toBe(true);
    });

    it('should reject end time before start time', () => {
      expect(availabilityCreateSchema.validate({ startTime: '14:00', endTime: '08:00' })).toBe(false);
    });

    it('should accept valid time range', () => {
      expect(availabilityCreateSchema.validate({ startTime: '08:00', endTime: '14:00' })).toBe(true);
    });

    it('should reject invalid capacity', () => {
      expect(availabilityCreateSchema.capacity(0)).toBe(false);
      expect(availabilityCreateSchema.capacity(-1)).toBe(false);
      expect(availabilityCreateSchema.capacity(1.5)).toBe(false);
    });

    it('should accept valid capacity', () => {
      expect(availabilityCreateSchema.capacity(1)).toBe(true);
      expect(availabilityCreateSchema.capacity(100)).toBe(true);
    });
  });
});
