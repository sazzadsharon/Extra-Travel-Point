import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

const routeCreateSchema = z.object({
  origin: z.string().min(2).max(100),
  destination: z.string().min(2).max(100),
  distanceKm: z.number().positive().optional(),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  isActive: z.boolean().optional()
});

const routeUpdateSchema = routeCreateSchema.partial();

async function getVendorProviderIds(userId: number): Promise<number[]> {
  const providers = await prisma.serviceProvider.findMany({
    where: { userId },
    select: { id: true }
  });
  return providers.map(p => p.id);
}

async function ensureRouteOwnership(routeId: number, userId: number): Promise<{ owned: boolean; route: any | null; provider: any | null }> {
  const route = await prisma.busRoute.findUnique({
    where: { id: routeId },
    include: { provider: { select: { userId: true, status: true, isActive: true } } }
  });
  if (!route) return { owned: false, route: null, provider: null };
  return {
    owned: route.provider.userId === userId,
    route,
    provider: route.provider
  };
}

function vendorNotApproved(res: any) {
  return res.status(403).json({ error: 'Only approved vendors can manage routes' });
}

// POST /api/v1/vendors/me/bus-routes
router.post('/', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const parse = routeCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const provider = await prisma.serviceProvider.findFirst({ where: { userId: req.user!.id } });
    if (!provider || provider.status !== 'APPROVED' || !provider.isActive) {
      return vendorNotApproved(res);
    }

    const { origin, destination } = parse.data;
    if (origin.toLowerCase() === destination.toLowerCase()) {
      return res.status(400).json({ error: 'Origin and destination cannot be the same' });
    }

    const existing = await prisma.busRoute.findFirst({
      where: {
        providerId: provider.id,
        origin: { equals: origin },
        destination: { equals: destination }
      }
    });
    if (existing) {
      return res.status(409).json({ error: 'Route already exists for this operator' });
    }

    const route = await prisma.busRoute.create({
      data: {
        providerId: provider.id,
        origin,
        destination,
        distanceKm: parse.data.distanceKm,
        estimatedDurationMinutes: parse.data.estimatedDurationMinutes,
        isActive: parse.data.isActive ?? true
      },
      include: { provider: { select: { id: true, businessName: true, category: true } } }
    });

    return res.status(201).json({ message: 'Route created successfully', route });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/vendors/me/bus-routes
router.get('/', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const providerIds = await getVendorProviderIds(req.user!.id);
    const { isActive } = req.query as Record<string, string | undefined>;

    const where: any = { providerId: { in: providerIds } };
    if (typeof isActive === 'string') {
      where.isActive = isActive === 'true';
    }

    const routes = await prisma.busRoute.findMany({
      where,
      include: {
        provider: { select: { id: true, businessName: true, city: true } },
        trips: { where: { isActive: true }, orderBy: { departureDate: 'asc' }, take: 5 }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ count: routes.length, routes });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/vendors/me/bus-routes/:id
router.get('/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const routeId = parseInt(req.params.id, 10);
    if (!Number.isFinite(routeId) || routeId <= 0) {
      return res.status(400).json({ error: 'Invalid route id' });
    }

    const { owned, route } = await ensureRouteOwnership(routeId, req.user!.id);
    if (!owned || !route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    return res.json(route);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/vendors/me/bus-routes/:id
router.patch('/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const routeId = parseInt(req.params.id, 10);
    if (!Number.isFinite(routeId) || routeId <= 0) {
      return res.status(400).json({ error: 'Invalid route id' });
    }

    const parse = routeUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { owned, route, provider } = await ensureRouteOwnership(routeId, req.user!.id);
    if (!owned || !route || !provider) {
      return res.status(404).json({ error: 'Route not found' });
    }

    if (provider.status !== 'APPROVED' || !provider.isActive) {
      return vendorNotApproved(res);
    }

    const data: any = { ...parse.data };
    if (data.origin && data.destination && data.origin.toLowerCase() === data.destination.toLowerCase()) {
      return res.status(400).json({ error: 'Origin and destination cannot be the same' });
    }

    const updated = await prisma.busRoute.update({
      where: { id: route.id },
      data,
      include: { provider: { select: { id: true, businessName: true, category: true } } }
    });

    return res.json({ message: 'Route updated successfully', route: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/vendors/me/bus-routes/:id (soft delete -> inactive)
router.delete('/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const routeId = parseInt(req.params.id, 10);
    if (!Number.isFinite(routeId) || routeId <= 0) {
      return res.status(400).json({ error: 'Invalid route id' });
    }

    const { owned, route } = await ensureRouteOwnership(routeId, req.user!.id);
    if (!owned || !route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const activeTrips = await prisma.busTrip.count({
      where: { routeId: route.id, status: { in: ['SCHEDULED', 'OPEN', 'BOARDING'] }, isActive: true }
    });

    if (activeTrips > 0) {
      const updated = await prisma.busRoute.update({
        where: { id: route.id },
        data: { isActive: false }
      });
      return res.json({ message: 'Route deactivated (active trips must be completed first)', route: updated });
    }

    await prisma.busRoute.delete({ where: { id: route.id } });
    return res.json({ message: 'Route deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
