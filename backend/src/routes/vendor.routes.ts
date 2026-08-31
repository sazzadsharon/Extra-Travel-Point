import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { notifyUser } from '../utils/notifications';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'extratravel_point_super_secret_jwt_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'extratravel_point_refresh_secret_key_2026';

// Fields a vendor is allowed to edit on their own profile
const EDITABLE_PROVIDER_FIELDS = [
  'businessName', 'category', 'description', 'address', 'city', 'phone', 'latitude', 'longitude'
] as const;

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'rejected'],
  confirmed: ['completed', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: [],
  refunded: [],
  expired: []
};

async function getVendorProviderIds(userId: number): Promise<number[]> {
  const providers = await prisma.serviceProvider.findMany({
    where: { userId },
    select: { id: true }
  });
  return providers.map(p => p.id);
}

function signTokens(user: { id: number; phone: string; role: string }) {
  const accessToken = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
  const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// 1. VENDOR REGISTRATION
// ---------------------------------------------------------------------------
const vendorRegisterSchema = z.object({
  phone: z.string().min(10).max(15),
  password: z.string().min(6),
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  businessName: z.string().min(2),
  category: z.string().min(1),
  ownerName: z.string().optional(),
  address: z.string().min(1),
  city: z.string().optional(),
  description: z.string().optional(),
  phoneBusiness: z.string().optional()
});

// POST /api/v1/vendors/register
router.post('/register', async (req, res) => {
  try {
    const parse = vendorRegisterSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const {
      phone, password, fullName, email,
      businessName, category, ownerName, address, city, description, phoneBusiness
    } = parse.data;

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { phone, email, fullName: fullName || ownerName, passwordHash, role: 'vendor' }
      });

      const provider = await tx.serviceProvider.create({
        data: {
          userId: user.id,
          businessName,
          category,
          description,
          address,
          city,
          phone: phoneBusiness || phone,
          status: 'PENDING',
          isVerified: false,
          isActive: false
        }
      });

      return { user, provider };
    });

    const tokens = signTokens(result.user);

    return res.status(201).json({
      message: 'Vendor registered successfully. Awaiting admin verification.',
      user: {
        id: result.user.id,
        phone: result.user.phone,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role
      },
      provider: result.provider,
      tokens
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 2. VENDOR PROFILE
// ---------------------------------------------------------------------------
// GET /api/v1/vendors/me
router.get('/me', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const provider = await prisma.serviceProvider.findFirst({
      where: { userId: req.user!.id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        services: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!provider) {
      return res.status(404).json({ error: 'Vendor profile not found. Please complete registration.' });
    }

    return res.json(provider);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/vendors/me
router.patch('/me', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const provider = await prisma.serviceProvider.findFirst({
      where: { userId: req.user!.id }
    });
    if (!provider) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const data: Record<string, any> = {};
    for (const field of EDITABLE_PROVIDER_FIELDS) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const updated = await prisma.serviceProvider.update({
      where: { id: provider.id },
      data
    });

    return res.json({ message: 'Profile updated successfully', provider: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 4 & 5 & 6. VENDOR SERVICES
// ---------------------------------------------------------------------------
const serviceCreateSchema = z.object({
  providerId: z.number(),
  name: z.string().min(2),
  category: z.string().min(1),
  description: z.string().optional(),
  route: z.string().optional(),
  price: z.number().positive(),
  capacity: z.number().int().positive().optional(),
  availability: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

const serviceUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  route: z.string().optional(),
  price: z.number().positive().optional(),
  capacity: z.number().int().positive().optional(),
  availability: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

// POST /api/v1/vendors/services
router.post('/services', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const parse = serviceCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const vendorProviderIds = await getVendorProviderIds(req.user!.id);
    if (!vendorProviderIds.includes(parse.data.providerId)) {
      return res.status(403).json({ error: 'You can only create services for your own business' });
    }

    const provider = await prisma.serviceProvider.findUnique({ where: { id: parse.data.providerId } });
    if (!provider || provider.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Only approved vendors can publish services' });
    }

    const service = await prisma.service.create({
      data: {
        providerId: parse.data.providerId,
        name: parse.data.name,
        category: parse.data.category,
        description: parse.data.description,
        route: parse.data.route,
        price: parse.data.price,
        capacity: parse.data.capacity,
        availability: parse.data.availability,
        status: parse.data.status || 'ACTIVE',
        isActive: parse.data.status ? parse.data.status === 'ACTIVE' : true
      }
    });

    return res.status(201).json({ message: 'Service created successfully', service });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/vendors/services
router.get('/services', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await getVendorProviderIds(req.user!.id);
    const services = await prisma.service.findMany({
      where: { providerId: { in: vendorProviderIds } },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(services);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/vendors/services/:id
router.get('/services/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await getVendorProviderIds(req.user!.id);
    const service = await prisma.service.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!service || !vendorProviderIds.includes(service.providerId)) {
      return res.status(404).json({ error: 'Service not found' });
    }
    return res.json(service);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/vendors/services/:id
router.patch('/services/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await getVendorProviderIds(req.user!.id);
    const service = await prisma.service.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!service || !vendorProviderIds.includes(service.providerId)) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const parse = serviceUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const data: any = { ...parse.data };
    if (data.status) {
      data.isActive = data.status === 'ACTIVE';
    }

    const updated = await prisma.service.update({
      where: { id: service.id },
      data
    });

    return res.json({ message: 'Service updated successfully', service: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/vendors/services/:id (soft delete -> INACTIVE)
router.delete('/services/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await getVendorProviderIds(req.user!.id);
    const service = await prisma.service.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!service || !vendorProviderIds.includes(service.providerId)) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { status: 'INACTIVE', isActive: false }
    });

    return res.json({ message: 'Service deactivated successfully', service: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// SERVICE AVAILABILITY
// ---------------------------------------------------------------------------
const availabilityCreateSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Invalid time format, expected HH:MM (00:00-23:59)' }).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Invalid time format, expected HH:MM (00:00-23:59)' }).optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional()
}).refine((data) => {
  if (data.startTime && data.endTime && data.startTime >= data.endTime) {
    return false;
  }
  return true;
}, { message: 'startTime must be before endTime' });

const availabilityUpdateSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Invalid time format, expected HH:MM (00:00-23:59)' }).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Invalid time format, expected HH:MM (00:00-23:59)' }).optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional()
}).refine((data) => {
  if (data.startTime && data.endTime && data.startTime >= data.endTime) {
    return false;
  }
  return true;
}, { message: 'startTime must be before endTime' });

async function ensureServiceOwnership(serviceId: number, userId: number): Promise<boolean> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { provider: { select: { userId: true } } }
  });
  return !!service && service.provider.userId === userId;
}

// POST /api/v1/vendors/services/:serviceId/availability
router.post('/services/:serviceId/availability', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const parse = availabilityCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const isOwner = await ensureServiceOwnership(serviceId, req.user!.id);
    if (!isOwner) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const provider = await prisma.serviceProvider.findFirst({
      where: { userId: req.user!.id }
    });
    if (!provider || provider.status !== 'APPROVED' || !provider.isActive) {
      return res.status(403).json({ error: 'Vendor account is not active/approved' });
    }

    const dateObj = new Date(parse.data.date);
    const availability = await prisma.serviceAvailability.create({
      data: {
        serviceId,
        date: dateObj,
        startTime: parse.data.startTime,
        endTime: parse.data.endTime,
        capacity: parse.data.capacity,
        isActive: parse.data.isActive ?? true
      }
    });

    return res.status(201).json({ message: 'Availability created successfully', availability });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/vendors/services/:serviceId/availability
router.get('/services/:serviceId/availability', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const isOwner = await ensureServiceOwnership(serviceId, req.user!.id);
    if (!isOwner) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const availabilities = await prisma.serviceAvailability.findMany({
      where: { serviceId },
      orderBy: { date: 'asc' }
    });

    return res.json(availabilities);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/vendors/services/:serviceId/availability/:availabilityId
router.patch('/services/:serviceId/availability/:availabilityId', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const availabilityId = parseInt(req.params.availabilityId);
    const parse = availabilityUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const isOwner = await ensureServiceOwnership(serviceId, req.user!.id);
    if (!isOwner) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const existing = await prisma.serviceAvailability.findUnique({
      where: { id: availabilityId }
    });
    if (!existing || existing.serviceId !== serviceId) {
      return res.status(404).json({ error: 'Availability record not found' });
    }

    const data: Record<string, any> = { ...parse.data };
    if (data.date) {
      data.date = new Date(data.date);
    }

    const updated = await prisma.serviceAvailability.update({
      where: { id: availabilityId },
      data
    });

    return res.json({ message: 'Availability updated successfully', availability: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/vendors/services/:serviceId/availability/:availabilityId
router.delete('/services/:serviceId/availability/:availabilityId', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    const availabilityId = parseInt(req.params.availabilityId);

    const isOwner = await ensureServiceOwnership(serviceId, req.user!.id);
    if (!isOwner) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const existing = await prisma.serviceAvailability.findUnique({
      where: { id: availabilityId }
    });
    if (!existing || existing.serviceId !== serviceId) {
      return res.status(404).json({ error: 'Availability record not found' });
    }

    await prisma.serviceAvailability.delete({
      where: { id: availabilityId }
    });

    return res.json({ message: 'Availability deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 9 & 10. VENDOR BOOKINGS
// ---------------------------------------------------------------------------
// GET /api/v1/vendors/bookings
router.get('/bookings', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await getVendorProviderIds(req.user!.id);
    const { status, paymentStatus } = req.query;

    const where: any = { providerId: { in: vendorProviderIds } };
    if (typeof status === 'string') where.status = status;
    if (typeof paymentStatus === 'string') where.paymentStatus = paymentStatus;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        service: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(bookings);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/vendors/bookings/:id  (vendor accept / reject / complete)
router.patch('/bookings/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await getVendorProviderIds(req.user!.id);
    const booking = await prisma.booking.findUnique({ where: { id: parseInt(req.params.id) } });

    if (!booking || !vendorProviderIds.includes(booking.providerId)) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const provider = await prisma.serviceProvider.findUnique({ where: { id: booking.providerId } });
    if (!provider || provider.status !== 'APPROVED' || !provider.isActive) {
      return res.status(403).json({ error: 'Vendor account is not active/approved' });
    }

    const { status, rejectionReason } = req.body;
    if (!status || typeof status !== 'string') {
      return res.status(400).json({ error: 'Target status is required' });
    }

    const allowed = VALID_TRANSITIONS[booking.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition: ${booking.status} -> ${status}`
      });
    }

    if (status === 'rejected') {
      if (typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
        return res.status(400).json({ error: 'rejectionReason is required when rejecting a booking' });
      }
      if (rejectionReason.trim().length > 500) {
        return res.status(400).json({ error: 'rejectionReason must be 500 characters or less' });
      }
    }

    const updateData: Record<string, any> = { status };
    if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason.trim();
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: updateData,
      include: { user: { select: { id: true, fullName: true, phone: true } }, service: true }
    });

    const statusMessages: Record<string, string> = {
      confirmed: 'Your booking has been confirmed by the vendor.',
      completed: 'Your booking has been marked as completed.',
      rejected: `Your booking was rejected. Reason: ${updated.rejectionReason || 'No reason provided'}`
    };

    if (statusMessages[status] && updated.userId !== req.user!.id) {
      notifyUser(updated.userId, `BOOKING_${status.toUpperCase()}`, `Booking ${status}`, statusMessages[status]);
    }

    return res.json({ message: `Booking ${status} successfully`, booking: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// VENDOR DASHBOARD STATS
// ---------------------------------------------------------------------------
// GET /api/v1/vendors/dashboard
router.get('/dashboard', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await getVendorProviderIds(req.user!.id);
    const provider = await prisma.serviceProvider.findFirst({ where: { userId: req.user!.id } });

    const services = await prisma.service.findMany({
      where: { providerId: { in: vendorProviderIds } }
    });

    const bookings = await prisma.booking.findMany({
      where: { providerId: { in: vendorProviderIds } },
      include: { payments: true }
    });

    const countByStatus = (s: string) => bookings.filter(b => b.status === s).length;

    const paidBookings = bookings.filter(b => b.paymentStatus === 'paid');
    const grossRevenue = paidBookings.reduce((sum, b) => sum + b.finalAmount, 0);
    const commissionRate = provider?.commissionRate || 10.0;
    const totalCommission = (grossRevenue * commissionRate) / 100;
    const vendorPayable = grossRevenue - totalCommission;

    return res.json({
      provider: provider
        ? {
            id: provider.id,
            businessName: provider.businessName,
            status: provider.status,
            isVerified: provider.isVerified,
            category: provider.category
          }
        : null,
      totalServices: services.length,
      activeServices: services.filter(s => s.status === 'ACTIVE').length,
      bookings: {
        total: bookings.length,
        pending: countByStatus('pending'),
        confirmed: countByStatus('confirmed'),
        completed: countByStatus('completed'),
        rejected: countByStatus('rejected'),
        cancelled: countByStatus('cancelled')
      },
      revenue: {
        gross: grossRevenue,
        commissionRate,
        commission: totalCommission,
        vendorPayable,
        currency: 'BDT'
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
