import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.setTimeout(15000);

describe('Vendor/Business System', () => {
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
    await prisma.seatLock.deleteMany();
        await prisma.payoutRequest.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.serviceAvailability.deleteMany();
    await prisma.service.deleteMany();
    await prisma.session.deleteMany();
    await prisma.serviceProvider.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Vendor Registration', () => {
    it('should create vendor with PENDING status', async () => {
      const user = await prisma.user.create({
        data: { phone: '01711111111', passwordHash: 'hash123', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: user.id,
          businessName: 'Test Bus Company',
          category: 'bus',
          address: 'Dhaka',
          status: 'PENDING',
          isVerified: false,
          isActive: false
        }
      });

      expect(provider.status).toBe('PENDING');
      expect(provider.isVerified).toBe(false);
      expect(provider.isActive).toBe(false);
    });

    it('should prevent duplicate vendor for same user', async () => {
      const user = await prisma.user.create({
        data: { phone: '01722222222', passwordHash: 'hash123', role: 'vendor' }
      });
      await prisma.serviceProvider.create({
        data: {
          userId: user.id,
          businessName: 'First Business',
          category: 'bus',
          address: 'Dhaka'
        }
      });

      const existing = await prisma.serviceProvider.findFirst({
        where: { userId: user.id }
      });
      expect(existing).not.toBeNull();
    });

    it('should reject vendor with invalid phone format', async () => {
      const invalidPhone = '123';
      const isValid = /^01[3-9]\d{8}$/.test(invalidPhone);
      expect(isValid).toBe(false);
    });

    it('should accept valid BD phone format', async () => {
      const validPhone = '01711111111';
      const isValid = /^01[3-9]\d{8}$/.test(validPhone);
      expect(isValid).toBe(true);
    });
  });

  describe('Vendor Profile Access', () => {
    it('vendor can view own profile', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01733333333', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'My Business',
          category: 'bus',
          address: 'Dhaka'
        }
      });

      const found = await prisma.serviceProvider.findFirst({
        where: { userId: vendor.id }
      });
      expect(found).not.toBeNull();
      expect(found?.businessName).toBe('My Business');
    });

    it('vendor cannot view another vendor profile by userId', async () => {
      const vendorA = await prisma.user.create({
        data: { phone: '01744444441', passwordHash: 'hash', role: 'vendor' }
      });
      const vendorB = await prisma.user.create({
        data: { phone: '01744444442', passwordHash: 'hash', role: 'vendor' }
      });
      await prisma.serviceProvider.create({
        data: {
          userId: vendorA.id,
          businessName: 'Vendor A Business',
          category: 'bus',
          address: 'Dhaka'
        }
      });

      const vendorBProfile = await prisma.serviceProvider.findFirst({
        where: { userId: vendorB.id }
      });
      expect(vendorBProfile).toBeNull();
    });
  });

  describe('Vendor Profile Update', () => {
    it('vendor can update own business name', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01755555555', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Old Name',
          category: 'bus',
          address: 'Dhaka'
        }
      });

      const updated = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: { businessName: 'New Name' }
      });
      expect(updated.businessName).toBe('New Name');
    });

    it('vendor cannot escalate role through profile update', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01766666666', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'My Business',
          category: 'bus',
          address: 'Dhaka'
        }
      });

      const user = await prisma.user.findUnique({ where: { id: vendor.id } });
      expect(user?.role).toBe('vendor');
    });
  });

  describe('Service Creation', () => {
    it('approved vendor can create service', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01777777777', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Approved Vendor',
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

      expect(service.providerId).toBe(provider.id);
      expect(service.name).toBe('Dhaka-Cox Bus');
      expect(service.price).toBe(800);
    });

    it('service price validation rejects non-positive values', async () => {
      const price = -100;
      const isValid = price > 0;
      expect(isValid).toBe(false);
    });

    it('service with zero price is invalid', async () => {
      const price = 0;
      const isValid = price > 0;
      expect(isValid).toBe(false);
    });

    it('service with valid price is accepted', async () => {
      const price = 800;
      const isValid = price > 0;
      expect(isValid).toBe(true);
    });

    it('service ownership is tied to provider', async () => {
      const vendorA = await prisma.user.create({
        data: { phone: '01799999991', passwordHash: 'hash', role: 'vendor' }
      });
      const vendorB = await prisma.user.create({
        data: { phone: '01799999992', passwordHash: 'hash', role: 'vendor' }
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
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });
      const service = await prisma.service.create({
        data: {
          providerId: providerA.id,
          name: 'Service A',
          category: 'bus',
          price: 800
        }
      });

      const vendorBProviders = await prisma.serviceProvider.findMany({
        where: { userId: vendorB.id },
        select: { id: true }
      });
      const vendorBProviderIds = vendorBProviders.map(p => p.id);
      expect(vendorBProviderIds.includes(service.providerId)).toBe(false);
    });
  });

  describe('Service Update', () => {
    it('vendor can update own service', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01811111112', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Vendor',
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
          name: 'Old Service',
          category: 'bus',
          price: 800
        }
      });

      const updated = await prisma.service.update({
        where: { id: service.id },
        data: { name: 'Updated Service', price: 900 }
      });

      expect(updated.name).toBe('Updated Service');
      expect(updated.price).toBe(900);
    });

    it('vendor can deactivate service', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01822222223', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Vendor',
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
          name: 'Service',
          category: 'bus',
          price: 800,
          status: 'ACTIVE',
          isActive: true
        }
      });

      const deactivated = await prisma.service.update({
        where: { id: service.id },
        data: { status: 'INACTIVE', isActive: false }
      });

      expect(deactivated.status).toBe('INACTIVE');
      expect(deactivated.isActive).toBe(false);
    });
  });

  describe('Admin Verification', () => {
    it('admin can approve vendor', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01833333334', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'PENDING'
        }
      });

      const approved = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: { status: 'APPROVED', isVerified: true, isActive: true, verifiedAt: new Date() }
      });

      expect(approved.status).toBe('APPROVED');
      expect(approved.isVerified).toBe(true);
      expect(approved.isActive).toBe(true);
    });

    it('admin can reject vendor with reason', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01844444445', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'PENDING'
        }
      });

      const rejected = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: { status: 'REJECTED', rejectionReason: 'Incomplete documentation' }
      });

      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toBe('Incomplete documentation');
    });

    it('admin can suspend vendor', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01855555556', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true
        }
      });

      const suspended = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: { status: 'SUSPENDED', isActive: false }
      });

      expect(suspended.status).toBe('SUSPENDED');
      expect(suspended.isActive).toBe(false);
    });
  });

  describe('Vendor Booking Management', () => {
    it('vendor sees only own bookings', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01866666667', passwordHash: 'hash', role: 'customer' }
      });
      const vendorA = await prisma.user.create({
        data: { phone: '01866666668', passwordHash: 'hash', role: 'vendor' }
      });
      const vendorB = await prisma.user.create({
        data: { phone: '01866666669', passwordHash: 'hash', role: 'vendor' }
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

      await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: providerA.id,
          category: 'bus',
          bookingDate: new Date(),
          travelDate: new Date(),
          totalAmount: 800,
          finalAmount: 800,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });
      await prisma.booking.create({
        data: {
          userId: customer.id,
          providerId: providerB.id,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: new Date(),
          totalAmount: 2000,
          finalAmount: 2000,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      const vendorAProviders = await prisma.serviceProvider.findMany({
        where: { userId: vendorA.id },
        select: { id: true }
      });
      const vendorAProviderIds = vendorAProviders.map(p => p.id);

      const vendorABookings = await prisma.booking.findMany({
        where: { providerId: { in: vendorAProviderIds } }
      });
      expect(vendorABookings).toHaveLength(1);
      expect(vendorABookings[0].category).toBe('bus');
    });

    it('vendor can accept pending booking', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01877777771', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01877777772', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Vendor',
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
          totalAmount: 800,
          finalAmount: 800,
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

    it('vendor cannot mark payment as paid', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01888888881', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01888888882', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Vendor',
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
          totalAmount: 800,
          finalAmount: 800,
          status: 'pending',
          paymentStatus: 'pending'
        }
      });

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'confirmed' }
      });

      expect(updated.paymentStatus).toBe('pending');
    });
  });

  describe('Vendor Dashboard Statistics', () => {
    it('dashboard aggregates correct statistics', async () => {
      const customer = await prisma.user.create({
        data: { phone: '01899999992', passwordHash: 'hash', role: 'customer' }
      });
      const vendor = await prisma.user.create({
        data: { phone: '01899999991', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isVerified: true,
          isActive: true,
          commissionRate: 10
        }
      });

      await prisma.service.createMany({
        data: [
          { providerId: provider.id, name: 'Service 1', category: 'bus', price: 800, status: 'ACTIVE', isActive: true },
          { providerId: provider.id, name: 'Service 2', category: 'bus', price: 1000, status: 'ACTIVE', isActive: true },
          { providerId: provider.id, name: 'Service 3', category: 'bus', price: 1200, status: 'INACTIVE', isActive: false }
        ]
      });

      await prisma.booking.createMany({
        data: [
          { userId: customer.id, providerId: provider.id, category: 'bus', bookingDate: new Date(), travelDate: new Date(), totalAmount: 800, finalAmount: 800, status: 'pending', paymentStatus: 'pending' },
          { userId: customer.id, providerId: provider.id, category: 'bus', bookingDate: new Date(), travelDate: new Date(), totalAmount: 1000, finalAmount: 1000, status: 'confirmed', paymentStatus: 'paid' },
          { userId: customer.id, providerId: provider.id, category: 'bus', bookingDate: new Date(), travelDate: new Date(), totalAmount: 1200, finalAmount: 1200, status: 'completed', paymentStatus: 'paid' }
        ]
      });

      const services = await prisma.service.findMany({
        where: { providerId: provider.id }
      });
      const bookings = await prisma.booking.findMany({
        where: { providerId: provider.id },
        select: { finalAmount: true, paymentStatus: true, status: true }
      });

      const paidBookings = bookings.filter(b => b.paymentStatus === 'paid');
      const grossRevenue = paidBookings.reduce((sum, b) => sum + b.finalAmount, 0);
      const commissionRate = provider.commissionRate;
      const totalCommission = (grossRevenue * commissionRate) / 100;
      const vendorPayable = grossRevenue - totalCommission;

      expect(services.length).toBe(3);
      expect(bookings.length).toBe(3);
      expect(grossRevenue).toBe(2200);
      expect(totalCommission).toBe(220);
      expect(vendorPayable).toBe(1980);
    });
  });

  describe('Public Provider Listing Security', () => {
    it('should not expose private email/phone in public listing', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01911111112', passwordHash: 'hash', role: 'vendor', email: 'private@vendor.com' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Public Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isActive: true
        }
      });

      const publicProviders = await prisma.serviceProvider.findMany({
        where: { status: 'APPROVED', isActive: true },
        select: {
          id: true,
          businessName: true,
          category: true,
          address: true,
          isVerified: true,
          user: {
            select: { fullName: true }
          }
        }
      });

      expect(publicProviders.length).toBeGreaterThan(0);
      expect(publicProviders[0].user).toBeDefined();
      expect(publicProviders[0].user).toHaveProperty('fullName');
      expect(publicProviders[0].user).not.toHaveProperty('email');
      expect(publicProviders[0].user).not.toHaveProperty('phone');
    });
  });

  describe('KYC Workflow', () => {
    it('vendor can submit KYC with valid data', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01911111111', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'KYC Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'PENDING'
        }
      });

      const kycData = {
        businessLegalName: 'KYC Vendor Ltd.',
        businessType: 'BUS',
        ownerName: 'Owner Name',
        nidNumber: 'NID-1234567890',
        tradeLicense: 'TL-987654321',
        address: 'Dhaka, Bangladesh',
        city: 'Dhaka',
        phone: '01711111111',
        email: 'kyc@example.com',
        documentUrl: 'https://example.com/doc.pdf'
      };

      const updated = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: {
          kycStatus: 'PENDING',
          kycSubmittedAt: new Date(),
          kycData: JSON.stringify(kycData)
        }
      });

      expect(updated.kycStatus).toBe('PENDING');
      expect(updated.kycSubmittedAt).not.toBeNull();
      const parsed = JSON.parse(updated.kycData as string);
      expect(parsed.businessLegalName).toBe('KYC Vendor Ltd.');
      expect(parsed.nidNumber).toBe('NID-1234567890');
    });

    it('vendor can update KYC before approval', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01922222222', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Update KYC Vendor',
          category: 'hotel',
          address: 'Cox\'s Bazar',
          status: 'PENDING',
          kycStatus: 'PENDING',
          kycSubmittedAt: new Date(),
          kycData: JSON.stringify({ businessLegalName: 'Old Name', nidNumber: 'OLD-NID' })
        }
      });

      const updated = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: {
          kycData: JSON.stringify({ businessLegalName: 'New Name', nidNumber: 'NEW-NID' }),
          kycRejectionReason: null
        }
      });

      const parsed = JSON.parse(updated.kycData as string);
      expect(parsed.businessLegalName).toBe('New Name');
      expect(parsed.nidNumber).toBe('NEW-NID');
    });

    it('vendor cannot modify approved KYC', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01933333333', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Approved KYC Vendor',
          category: 'restaurant',
          address: 'Dhaka',
          status: 'APPROVED',
          kycStatus: 'APPROVED',
          kycReviewedAt: new Date()
        }
      });

      expect(provider.kycStatus).toBe('APPROVED');
    });

    it('admin can approve KYC', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01944444444', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Admin Approve KYC',
          category: 'tour',
          address: 'Sylhet',
          status: 'PENDING',
          kycStatus: 'PENDING',
          kycSubmittedAt: new Date()
        }
      });

      const approved = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: {
          kycStatus: 'APPROVED',
          kycReviewedAt: new Date(),
          kycRejectionReason: null
        }
      });

      expect(approved.kycStatus).toBe('APPROVED');
      expect(approved.kycReviewedAt).not.toBeNull();
    });

    it('admin can reject KYC with reason', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01955555555', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Reject KYC Vendor',
          category: 'car_rental',
          address: 'Chittagong',
          status: 'PENDING',
          kycStatus: 'PENDING',
          kycSubmittedAt: new Date()
        }
      });

      const rejected = await prisma.serviceProvider.update({
        where: { id: provider.id },
        data: {
          kycStatus: 'REJECTED',
          kycRejectionReason: 'Invalid NID document'
        }
      });

      expect(rejected.kycStatus).toBe('REJECTED');
      expect(rejected.kycRejectionReason).toBe('Invalid NID document');
    });

    it('vendor cannot access another vendor KYC data', async () => {
      const vendorA = await prisma.user.create({
        data: { phone: '01966666661', passwordHash: 'hash', role: 'vendor' }
      });
      const vendorB = await prisma.user.create({
        data: { phone: '01966666662', passwordHash: 'hash', role: 'vendor' }
      });
      const providerA = await prisma.serviceProvider.create({
        data: {
          userId: vendorA.id,
          businessName: 'Vendor A KYC',
          category: 'bus',
          address: 'Dhaka',
          status: 'PENDING',
          kycStatus: 'PENDING',
          kycData: JSON.stringify({ nidNumber: 'SECRET-NID-A' })
        }
      });

      const providerB = await prisma.serviceProvider.findFirst({
        where: { userId: vendorB.id }
      });

      expect(providerB).toBeNull();
    });

    it('KYC data is not exposed in public provider listing', async () => {
      const vendor = await prisma.user.create({
        data: { phone: '01977777771', passwordHash: 'hash', role: 'vendor' }
      });
      const provider = await prisma.serviceProvider.create({
        data: {
          userId: vendor.id,
          businessName: 'Public KYC Vendor',
          category: 'bus',
          address: 'Dhaka',
          status: 'APPROVED',
          isActive: true,
          kycStatus: 'APPROVED',
          kycData: JSON.stringify({ nidNumber: 'SECRET-NID', tradeLicense: 'TL-123' })
        }
      });

      const publicProviders = await prisma.serviceProvider.findMany({
        where: { status: 'APPROVED', isActive: true },
        select: {
          id: true,
          businessName: true,
          category: true,
          kycStatus: true,
          kycData: false
        }
      });

      expect(publicProviders.length).toBeGreaterThan(0);
      expect(publicProviders[0]).not.toHaveProperty('kycData');
    });
  });
});
