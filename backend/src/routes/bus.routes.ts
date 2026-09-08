import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

const BUS_TYPES = ['AC', 'NON_AC', 'SLEEPER', 'SEMI_SLEEPER', 'DOUBLE_DECKER'] as const;
type BusType = (typeof BUS_TYPES)[number];

const BUS_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] as const;
type BusStatus = (typeof BUS_STATUSES)[number];

const busCreateSchema = z.object({
  registrationNumber: z.string().min(3).max(50),
  busName: z.string().min(2).max(100),
  busType: z.enum(BUS_TYPES),
  totalSeats: z.number().int().positive().max(100),
  amenities: z.string().optional(),
  status: z.enum(BUS_STATUSES).optional()
});

const busUpdateSchema = z.object({
  registrationNumber: z.string().min(3).max(50).optional(),
  busName: z.string().min(2).max(100).optional(),
  busType: z.enum(BUS_TYPES).optional(),
  totalSeats: z.number().int().positive().max(100).optional(),
  amenities: z.string().optional(),
  status: z.enum(BUS_STATUSES).optional(),
  isActive: z.boolean().optional()
}).partial();

async function getVendorProviderIds(userId: number): Promise<number[]> {
  const providers = await prisma.serviceProvider.findMany({
    where: { userId },
    select: { id: true }
  });
  return providers.map(p => p.id);
}

async function ensureBusOwnership(busId: number, userId: number): Promise<{ owned: boolean; bus: any | null; provider: any | null }> {
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    include: { provider: { select: { userId: true, status: true, isActive: true } } }
  });
  if (!bus) return { owned: false, bus: null, provider: null };
  return {
    owned: bus.provider.userId === userId,
    bus,
    provider: bus.provider
  };
}

function vendorNotApproved(res: any) {
  return res.status(403).json({ error: 'Only approved vendors can manage buses' });
}

// POST /api/v1/vendors/me/buses
router.post('/', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const parse = busCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const provider = await prisma.serviceProvider.findFirst({ where: { userId: req.user!.id } });
    if (!provider || provider.status !== 'APPROVED' || !provider.isActive) {
      return vendorNotApproved(res);
    }

    const existing = await prisma.bus.findFirst({
      where: { registrationNumber: parse.data.registrationNumber }
    });
    if (existing) {
      return res.status(409).json({ error: 'Bus with this registration number already exists' });
    }

    const bus = await prisma.bus.create({
      data: {
        providerId: provider.id,
        registrationNumber: parse.data.registrationNumber,
        busName: parse.data.busName,
        busType: parse.data.busType,
        totalSeats: parse.data.totalSeats,
        amenities: parse.data.amenities,
        status: parse.data.status || 'ACTIVE',
        isActive: parse.data.status ? parse.data.status === 'ACTIVE' : true
      },
      include: { provider: { select: { id: true, businessName: true, category: true } } }
    });

    return res.status(201).json({ message: 'Bus created successfully', bus });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/vendors/me/buses
router.get('/', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const providerIds = await getVendorProviderIds(req.user!.id);
    const { status, busType } = req.query as Record<string, string | undefined>;

    const where: any = { providerId: { in: providerIds } };
    if (status) where.status = status;
    if (busType) where.busType = busType;

    const buses = await prisma.bus.findMany({
      where,
      include: {
        provider: { select: { id: true, businessName: true, city: true } },
        trips: { where: { isActive: true }, orderBy: { departureDate: 'asc' }, take: 5 }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ count: buses.length, buses });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/vendors/me/buses/:id
router.get('/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const busId = parseInt(req.params.id, 10);
    if (!Number.isFinite(busId) || busId <= 0) {
      return res.status(400).json({ error: 'Invalid bus id' });
    }

    const { owned, bus, provider } = await ensureBusOwnership(busId, req.user!.id);
    if (!owned || !bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    return res.json(bus);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/vendors/me/buses/:id
router.patch('/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const busId = parseInt(req.params.id, 10);
    if (!Number.isFinite(busId) || busId <= 0) {
      return res.status(400).json({ error: 'Invalid bus id' });
    }

    const parse = busUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { owned, bus, provider } = await ensureBusOwnership(busId, req.user!.id);
    if (!owned || !bus || !provider) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    if (provider.status !== 'APPROVED' || !provider.isActive) {
      return vendorNotApproved(res);
    }

    const data: any = { ...parse.data };
    if (data.status) {
      data.isActive = data.status === 'ACTIVE';
    }

    const updated = await prisma.bus.update({
      where: { id: bus.id },
      data,
      include: { provider: { select: { id: true, businessName: true, category: true } } }
    });

    return res.json({ message: 'Bus updated successfully', bus: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/vendors/me/buses/:id (soft delete -> INACTIVE)
router.delete('/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const busId = parseInt(req.params.id, 10);
    if (!Number.isFinite(busId) || busId <= 0) {
      return res.status(400).json({ error: 'Invalid bus id' });
    }

    const { owned, bus } = await ensureBusOwnership(busId, req.user!.id);
    if (!owned || !bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    const activeTrips = await prisma.busTrip.count({
      where: { busId: bus.id, status: { in: ['SCHEDULED', 'OPEN', 'BOARDING'] }, isActive: true }
    });

    if (activeTrips > 0) {
      const updated = await prisma.bus.update({
        where: { id: bus.id },
        data: { status: 'INACTIVE', isActive: false }
      });
      return res.json({ message: 'Bus deactivated (active trips must be completed first)', bus: updated });
    }

    await prisma.bus.delete({ where: { id: bus.id } });
    return res.json({ message: 'Bus deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
