import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

export const SERVICE_TYPES = [
  'BUS',
  'HOTEL',
  'RESTAURANT',
  'TOUR',
  'ACTIVITY',
  'CAR_RENTAL',
  'BOAT',
  'TRANSPORT',
  'OTHER'
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const LIFECYCLE_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'SUSPENDED',
  'ARCHIVED'
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

const CURRENCY_RE = /^[A-Z]{3}$/;

const daysArraySchema = z
  .array(z.number().int().min(0).max(6))
  .max(7);

const availableDaysField = z
  .union([z.array(z.number().int()), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) {
      const parsed = daysArraySchema.safeParse(value);
      return parsed.success ? JSON.stringify(parsed.data) : undefined;
    }
    try {
      const parsed = JSON.parse(value);
      const result = daysArraySchema.safeParse(parsed);
      return result.success ? JSON.stringify(result.data) : undefined;
    } catch {
      const nums = value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 0 && n <= 6);
      return nums.length ? JSON.stringify(nums) : undefined;
    }
  });

const imagesField = z
  .union([z.array(z.string().url()), z.array(z.string()), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return JSON.stringify(value);
    return value;
  });

const baseServiceFields = {
  name: z.string().min(2).max(150),
  serviceType: z.enum(SERVICE_TYPES).optional(),
  category: z.string().min(1).max(60).optional(),
  description: z.string().max(2000).optional(),
  route: z.string().max(255).optional(),
  price: z.number().nonnegative(),
  currency: z.string().regex(CURRENCY_RE, { message: 'currency must be a 3-letter ISO code' }).optional(),
  capacity: z.number().int().positive().optional(),
  availability: z.string().max(255).optional(),
  locationCity: z.string().max(80).optional(),
  locationAddress: z.string().max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  images: imagesField,
  availableDays: availableDaysField,
  startDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
};

const createServiceSchema = z
  .object({
    ...baseServiceFields,
    lifecycleStatus: z.enum(LIFECYCLE_STATUSES).optional()
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate.getTime() <= data.endDate.getTime();
      }
      return true;
    },
    { message: 'startDate must be before or equal to endDate', path: ['endDate'] }
  );

const updateServiceSchema = z
  .object({
    ...baseServiceFields,
    lifecycleStatus: z.enum(LIFECYCLE_STATUSES).optional()
  })
  .partial()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate.getTime() <= data.endDate.getTime();
      }
      return true;
    },
    { message: 'startDate must be before or equal to endDate', path: ['endDate'] }
  );

const adminUpdateSchema = z.object({
  lifecycleStatus: z.enum(LIFECYCLE_STATUSES).optional(),
  rejectionReason: z.string().max(500).optional()
});

async function getVendorProviderIds(userId: number): Promise<number[]> {
  const providers = await prisma.serviceProvider.findMany({
    where: { userId },
    select: { id: true }
  });
  return providers.map((p) => p.id);
}

async function ensureServiceOwnership(
  serviceId: number,
  userId: number
): Promise<{ owned: boolean; service: any | null; provider: any | null }> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { provider: true }
  });
  if (!service) return { owned: false, service: null, provider: null };
  return {
    owned: service.provider.userId === userId,
    service,
    provider: service.provider
  };
}

async function getPrimaryProvider(userId: number) {
  return prisma.serviceProvider.findFirst({ where: { userId } });
}

function vendorNotApproved(res: any) {
  return res.status(403).json({ error: 'Only approved vendors can manage services' });
}

// ===========================================================================
// VENDOR-SIDE ROUTER  (mount under /api/v1/vendors)
// ===========================================================================
export const vendorServiceRouter = Router();

// POST /api/v1/vendors/me/services
vendorServiceRouter.post(
  '/me/services',
  authenticateJWT,
  requireRole(['vendor']),
  async (req: AuthRequest, res) => {
    try {
      const parse = createServiceSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: parse.error.issues });
      }

      const provider = await getPrimaryProvider(req.user!.id);
      if (!provider || provider.status !== 'APPROVED' || !provider.isActive) {
        return vendorNotApproved(res);
      }

      const data = parse.data;
      const lifecycleStatus: LifecycleStatus = data.lifecycleStatus ?? 'DRAFT';

      const service = await prisma.service.create({
        data: {
          providerId: provider.id,
          name: data.name,
          category: data.category ?? data.serviceType?.toLowerCase() ?? 'other',
          serviceType: data.serviceType ?? 'OTHER',
          description: data.description,
          route: data.route,
          price: data.price,
          currency: data.currency ?? 'BDT',
          capacity: data.capacity,
          availability: data.availability,
          status: lifecycleStatus === 'PUBLISHED' ? 'ACTIVE' : 'INACTIVE',
          isActive: lifecycleStatus === 'PUBLISHED',
          lifecycleStatus,
          locationCity: data.locationCity,
          locationAddress: data.locationAddress,
          latitude: data.latitude,
          longitude: data.longitude,
          images: data.images,
          availableDays: data.availableDays,
          startDate: data.startDate,
          endDate: data.endDate
        }
      });

      return res.status(201).json({ message: 'Service created successfully', service });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/v1/vendors/me/services
vendorServiceRouter.get(
  '/me/services',
  authenticateJWT,
  requireRole(['vendor']),
  async (req: AuthRequest, res) => {
    try {
      const providerIds = await getVendorProviderIds(req.user!.id);
      const { lifecycleStatus, serviceType } = req.query as Record<string, string | undefined>;

      const where: any = { providerId: { in: providerIds } };
      if (lifecycleStatus) where.lifecycleStatus = lifecycleStatus;
      if (serviceType) where.serviceType = serviceType;

      const services = await prisma.service.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });
      return res.json(services);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/v1/vendors/me/services/:id
vendorServiceRouter.get(
  '/me/services/:id',
  authenticateJWT,
  requireRole(['vendor']),
  async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid service id' });
      }
      const { owned, service } = await ensureServiceOwnership(id, req.user!.id);
      if (!owned || !service) {
        return res.status(404).json({ error: 'Service not found' });
      }
      return res.json(service);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/v1/vendors/me/services/:id
vendorServiceRouter.patch(
  '/me/services/:id',
  authenticateJWT,
  requireRole(['vendor']),
  async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid service id' });
      }

      const parse = updateServiceSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: parse.error.issues });
      }

      const { owned, service, provider } = await ensureServiceOwnership(id, req.user!.id);
      if (!owned || !service || !provider) {
        return res.status(404).json({ error: 'Service not found' });
      }

      if (provider.status !== 'APPROVED' || !provider.isActive) {
        return vendorNotApproved(res);
      }

      const data = parse.data;

      // Preserve lifecycle invariants:
      // - Suspended / Rejected services stay locked (admin must restore first)
      // - Vendor cannot self-clear REJECTED/SUSPENDED lifecycle
      let nextLifecycle: LifecycleStatus = (service.lifecycleStatus as LifecycleStatus);
      if (service.lifecycleStatus !== 'SUSPENDED' && service.lifecycleStatus !== 'REJECTED') {
        if (data.lifecycleStatus) {
          if (data.lifecycleStatus === 'SUSPENDED' || data.lifecycleStatus === 'REJECTED') {
            // vendor cannot self-suspend/reject
          } else {
            nextLifecycle = data.lifecycleStatus;
          }
        }
      }

      const legacyStatus = nextLifecycle === 'PUBLISHED' ? 'ACTIVE' : 'INACTIVE';
      const isActive = nextLifecycle === 'PUBLISHED';

      const updated = await prisma.service.update({
        where: { id: service.id },
        data: {
          name: data.name ?? undefined,
          category: data.category ?? undefined,
          serviceType: data.serviceType ?? undefined,
          description: data.description ?? undefined,
          route: data.route ?? undefined,
          price: data.price ?? undefined,
          currency: data.currency ?? undefined,
          capacity: data.capacity ?? undefined,
          availability: data.availability ?? undefined,
          locationCity: data.locationCity ?? undefined,
          locationAddress: data.locationAddress ?? undefined,
          latitude: data.latitude ?? undefined,
          longitude: data.longitude ?? undefined,
          images: data.images ?? undefined,
          availableDays: data.availableDays ?? undefined,
          startDate: data.startDate ?? undefined,
          endDate: data.endDate ?? undefined,
          lifecycleStatus: nextLifecycle,
          status: legacyStatus,
          isActive
        }
      });

      return res.json({ message: 'Service updated successfully', service: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/v1/vendors/me/services/:id
vendorServiceRouter.delete(
  '/me/services/:id',
  authenticateJWT,
  requireRole(['vendor']),
  async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid service id' });
      }
      const { owned, service } = await ensureServiceOwnership(id, req.user!.id);
      if (!owned || !service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const bookingCount = await prisma.booking.count({ where: { serviceId: service.id } });
      if (bookingCount > 0) {
        const updated = await prisma.service.update({
          where: { id: service.id },
          data: { lifecycleStatus: 'ARCHIVED', status: 'INACTIVE', isActive: false }
        });
        return res.json({ message: 'Service archived (existing bookings preserved)', service: updated });
      }

      await prisma.serviceAvailability.deleteMany({ where: { serviceId: service.id } });
      await prisma.service.delete({ where: { id: service.id } });
      return res.json({ message: 'Service deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/v1/vendors/me/services/:id/publish
vendorServiceRouter.patch(
  '/me/services/:id/publish',
  authenticateJWT,
  requireRole(['vendor']),
  async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid service id' });
      }
      const { owned, service, provider } = await ensureServiceOwnership(id, req.user!.id);
      if (!owned || !service || !provider) {
        return res.status(404).json({ error: 'Service not found' });
      }
      if (provider.status !== 'APPROVED' || !provider.isActive) {
        return res.status(403).json({ error: 'Only approved vendors can publish services' });
      }
      if (service.lifecycleStatus === 'SUSPENDED') {
        return res.status(403).json({ error: 'Suspended services cannot be published' });
      }
      if (service.lifecycleStatus === 'REJECTED') {
        return res.status(403).json({ error: 'Rejected services cannot be published without admin review' });
      }
      if (service.lifecycleStatus === 'ARCHIVED') {
        return res.status(403).json({ error: 'Archived services cannot be published' });
      }

      const updated = await prisma.service.update({
        where: { id: service.id },
        data: {
          lifecycleStatus: 'PUBLISHED',
          status: 'ACTIVE',
          isActive: true,
          rejectionReason: null
        }
      });

      return res.json({ message: 'Service published successfully', service: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/v1/vendors/me/services/:id/unpublish
vendorServiceRouter.patch(
  '/me/services/:id/unpublish',
  authenticateJWT,
  requireRole(['vendor']),
  async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid service id' });
      }
      const { owned, service } = await ensureServiceOwnership(id, req.user!.id);
      if (!owned || !service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const updated = await prisma.service.update({
        where: { id: service.id },
        data: { lifecycleStatus: 'DRAFT', status: 'INACTIVE', isActive: false }
      });

      return res.json({ message: 'Service unpublished successfully', service: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// ===========================================================================
// PUBLIC + ADMIN ROUTER  (mount under /api/v1)
// ===========================================================================
export const publicAdminServiceRouter = Router();

// GET /api/v1/vendor-services/discover  (PUBLIC)
publicAdminServiceRouter.get('/vendor-services/discover', async (req, res) => {
  try {
    const { serviceType, city, q } = req.query as Record<string, string | undefined>;

    const where: any = {
      lifecycleStatus: 'PUBLISHED',
      isActive: true,
      provider: { status: 'APPROVED', isActive: true }
    };
    if (serviceType) where.serviceType = serviceType;
    if (city) where.locationCity = city;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { route: { contains: q } }
      ];
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            city: true,
            rating: true,
            totalReviews: true,
            logo: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return res.json({ count: services.length, services });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/vendor-services
publicAdminServiceRouter.get(
  '/admin/vendor-services',
  authenticateJWT,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const { lifecycleStatus, serviceType, providerId } = req.query as Record<string, string | undefined>;

      const where: any = {};
      if (lifecycleStatus) where.lifecycleStatus = lifecycleStatus;
      if (serviceType) where.serviceType = serviceType;
      if (providerId) where.providerId = parseInt(providerId, 10);

      const services = await prisma.service.findMany({
        where,
        include: {
          provider: {
            select: { id: true, businessName: true, status: true, userId: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ count: services.length, services });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/v1/admin/vendor-services/:id
publicAdminServiceRouter.get(
  '/admin/vendor-services/:id',
  authenticateJWT,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid service id' });
      }
      const service = await prisma.service.findUnique({
        where: { id },
        include: { provider: true }
      });
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }
      return res.json(service);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/v1/admin/vendor-services/:id/suspend
publicAdminServiceRouter.patch(
  '/admin/vendor-services/:id/suspend',
  authenticateJWT,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid service id' });
      }
      const service = await prisma.service.findUnique({ where: { id } });
      if (!service) return res.status(404).json({ error: 'Service not found' });

      const updated = await prisma.service.update({
        where: { id },
        data: { lifecycleStatus: 'SUSPENDED', status: 'INACTIVE', isActive: false }
      });
      return res.json({ message: 'Service suspended', service: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/v1/admin/vendor-services/:id/restore
publicAdminServiceRouter.patch(
  '/admin/vendor-services/:id/restore',
  authenticateJWT,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid service id' });
      }
      const service = await prisma.service.findUnique({ where: { id } });
      if (!service) return res.status(404).json({ error: 'Service not found' });

      const updated = await prisma.service.update({
        where: { id },
        data: { lifecycleStatus: 'PUBLISHED', status: 'ACTIVE', isActive: true, rejectionReason: null }
      });
      return res.json({ message: 'Service restored', service: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/v1/admin/vendor-services/:id/reject
publicAdminServiceRouter.patch(
  '/admin/vendor-services/:id/reject',
  authenticateJWT,
  requireRole(['admin']),
  async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid service id' });
      }
      const parse = adminUpdateSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: parse.error.issues });
      }
      const service = await prisma.service.findUnique({ where: { id } });
      if (!service) return res.status(404).json({ error: 'Service not found' });

      const updated = await prisma.service.update({
        where: { id },
        data: {
          lifecycleStatus: 'REJECTED',
          status: 'INACTIVE',
          isActive: false,
          rejectionReason: parse.data.rejectionReason ?? null
        }
      });
      return res.json({ message: 'Service rejected', service: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Default export: legacy single-router entrypoint (mountable on /api/v1).
// Combines vendor + admin/public routes by mounting each.
const combinedRouter = Router();
combinedRouter.use(vendorServiceRouter);
combinedRouter.use(publicAdminServiceRouter);

export default combinedRouter;