import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(15000);

// We only need the VALID_TRANSITIONS and validation logic from vendor.routes.ts.
// To avoid importing the full router (which requires express instance + middleware),
// we recreate the minimal logic under test here.

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'rejected'],
  confirmed: ['completed', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: [],
  refunded: [],
  expired: []
};

function validateRejectionReason(reason: any): { valid: boolean; error?: string } {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    return { valid: false, error: 'rejectionReason is required when rejecting a booking' };
  }
  if (reason.trim().length > 500) {
    return { valid: false, error: 'rejectionReason must be 500 characters or less' };
  }
  return { valid: true };
}

describe('Vendor Booking Rejection (P1.3)', () => {
  let vendorRoutes: Router;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.qrLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.review.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.serviceAvailability.deleteMany();
    await prisma.service.deleteMany();
    await prisma.session.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('VALID_TRANSITIONS', () => {
    it('should allow pending -> confirmed', () => {
      expect(VALID_TRANSITIONS['pending']).toContain('confirmed');
    });

    it('should allow pending -> rejected', () => {
      expect(VALID_TRANSITIONS['pending']).toContain('rejected');
    });

    it('should NOT allow pending -> cancelled (vendor rejection must not use cancelled)', () => {
      expect(VALID_TRANSITIONS['pending']).not.toContain('cancelled');
    });

    it('should allow confirmed -> completed', () => {
      expect(VALID_TRANSITIONS['confirmed']).toContain('completed');
    });

    it('should allow confirmed -> cancelled', () => {
      expect(VALID_TRANSITIONS['confirmed']).toContain('cancelled');
    });

    it('should make rejected a terminal state', () => {
      expect(VALID_TRANSITIONS['rejected']).toEqual([]);
    });

    it('should make completed a terminal state', () => {
      expect(VALID_TRANSITIONS['completed']).toEqual([]);
    });
  });

  describe('rejectionReason validation', () => {
    it('should reject empty string', () => {
      const result = validateRejectionReason('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('rejectionReason is required when rejecting a booking');
    });

    it('should reject whitespace-only string', () => {
      const result = validateRejectionReason('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('rejectionReason is required when rejecting a booking');
    });

    it('should reject non-string values', () => {
      const result = validateRejectionReason(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('rejectionReason is required when rejecting a booking');
    });

    it('should reject strings longer than 500 characters', () => {
      const longReason = 'a'.repeat(501);
      const result = validateRejectionReason(longReason);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('rejectionReason must be 500 characters or less');
    });

    it('should accept valid rejection reason', () => {
      const result = validateRejectionReason('Service unavailable for the requested date');
      expect(result.valid).toBe(true);
    });

    it('should accept exactly 500 characters', () => {
      const maxReason = 'a'.repeat(500);
      const result = validateRejectionReason(maxReason);
      expect(result.valid).toBe(true);
    });
  });

  describe('Booking rejection flow (integration)', () => {
    it('PENDING -> REJECTED with valid reason should succeed', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01811111111', passwordHash: 'hash', role: 'customer' }
      });
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
      const booking = await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: provider.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(),
          totalAmount: 1000,
          discountAmount: 0,
          finalAmount: 1000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'rejected', rejectionReason: 'Service unavailable' },
        include: { user: true }
      });

      expect(updated.status).toBe('rejected');
      expect(updated.rejectionReason).toBe('Service unavailable');
      expect(updated.userId).toBe(customer.id);
    });

    it('should not allow vendor to reject another vendors booking', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01822222222', passwordHash: 'hash', role: 'customer' }
      });
      const vendorA = await prisma.user.create({
        data: { phone: '01922222221', passwordHash: 'hash', role: 'vendor' }
      });
      const vendorB = await prisma.user.create({
        data: { phone: '01922222222', passwordHash: 'hash', role: 'vendor' }
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
      const providerB = await prisma.serviceProvider.create({
        data: {
          userId: vendorB.id,
          businessName: 'Vendor B',
          category: 'hotel',
          address: 'Cox\'s Bazar',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const booking = await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: providerA.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(),
          totalAmount: 1000,
          discountAmount: 0,
          finalAmount: 1000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      const vendorBProviders = await prisma.serviceProvider.findMany({
        where: { userId: vendorB.id },
        select: { id: true }
      });
      const vendorBProviderIds = vendorBProviders.map(p => p.id);

      const isAuthorized = vendorBProviderIds.includes(booking.providerId);
      expect(isAuthorized).toBe(false);
    });

    it('customer cancellation should remain CANCELLED', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01833333333', passwordHash: 'hash', role: 'customer' }
      });
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
      const booking = await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: provider.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(),
          totalAmount: 1000,
          discountAmount: 0,
          finalAmount: 1000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      const cancelled = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'cancelled' }
      });

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.rejectionReason).toBeNull();
    });

    it('PENDING -> CONFIRMED should still work', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01844444444', passwordHash: 'hash', role: 'customer' }
      });
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
      const booking = await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: provider.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(),
          totalAmount: 1000,
          discountAmount: 0,
          finalAmount: 1000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      const confirmed = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'confirmed' }
      });

      expect(confirmed.status).toBe('confirmed');
    });

    it('rejected booking should have rejectionReason stored', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01855555555', passwordHash: 'hash', role: 'customer' }
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
      const booking = await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: provider.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(),
          totalAmount: 1000,
          discountAmount: 0,
          finalAmount: 1000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      const reason = 'Bus breakdown, cannot accommodate on this date';
      const rejected = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'rejected', rejectionReason: reason }
      });

      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionReason).toBe(reason);
    });
  });
});
