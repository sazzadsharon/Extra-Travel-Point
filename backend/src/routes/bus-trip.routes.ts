import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

const TRIP_STATUSES = ['SCHEDULED', 'OPEN', 'CLOSED', 'BOARDING', 'DEPARTED', 'COMPLETED', 'CANCELLED'] as const;
type TripStatus = (typeof TRIP_STATUSES)[number];

const tripCreateSchema = z.object({
  busId: z.number().int().positive(),
  routeId: z.number().int().positive(),
  departureDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid departureDate' }),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Invalid departureTime, expected HH:MM (00:00-23:59)' }),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Invalid arrivalTime, expected HH:MM (00:00-23:59)' }),
  availableSeats: z.number().int().positive().optional(),
  pricePerSeat: z.number().nonnegative().optional(),
  bookingCutoffMinutes: z.number().int().positive().max(1440).optional(),
  status: z.enum(['SCHEDULED', 'OPEN']).optional()
}).refine((data) => {
  if (data.departureTime && data.arrivalTime && data.departureTime >= data.arrivalTime) {
    return false;
  }
  return true;
}, { message: 'departureTime must be before arrivalTime', path: ['arrivalTime'] });

const tripUpdateSchema = z.object({
  departureDate: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid departureDate' }).optional(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  availableSeats: z.number().int().positive().optional(),
  pricePerSeat: z.number().nonnegative().optional(),
  bookingCutoffMinutes: z.number().int().positive().max(1440).optional(),
  status: z.enum(['SCHEDULED', 'OPEN', 'CLOSED', 'BOARDING', 'DEPARTED', 'COMPLETED', 'CANCELLED']).optional(),
  isActive: z.boolean().optional()
}).refine((data) => {
  if (data.departureTime && data.arrivalTime && data.departureTime >= data.arrivalTime) {
    return false;
  }
  return true;
}, { message: 'departureTime must be before arrivalTime', path: ['arrivalTime'] });

async function getVendorProviderIds(userId: number): Promise<number[]> {
  const providers = await prisma.serviceProvider.findMany({
    where: { userId },
    select: { id: true }
  });
  return providers.map(p => p.id);
}

async function ensureTripOwnership(tripId: number, userId: number): Promise<{ owned: boolean; trip: any | null; provider: any | null }> {
  const trip = await prisma.busTrip.findUnique({
    where: { id: tripId },
    include: { provider: { select: { userId: true, status: true, isActive: true } } }
  });
  if (!trip) return { owned: false, trip: null, provider: null };
  return {
    owned: trip.provider.userId === userId,
    trip,
    provider: trip.provider
  };
}

function vendorNotApproved(res: any) {
  return res.status(403).json({ error: 'Only approved vendors can manage trips' });
}

function buildTimestamps(departureDate: string, departureTime: string, arrivalTime: string): { departureTimestamp: Date; arrivalTimestamp: Date } {
  const depTimestamp = new Date(`${departureDate}T${departureTime}:00`);
  const arrTimestamp = new Date(`${departureDate}T${arrivalTime}:00`);
  if (arrTimestamp < depTimestamp) {
    arrTimestamp.setDate(arrTimestamp.getDate() + 1);
  }
  return { departureTimestamp: depTimestamp, arrivalTimestamp: arrTimestamp };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'BOARDING', 'CANCELLED'],
  CLOSED: ['BOARDING', 'CANCELLED'],
  BOARDING: ['DEPARTED', 'CANCELLED'],
  DEPARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};

// POST /api/v1/vendors/me/bus-trips
router.post('/', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const parse = tripCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const provider = await prisma.serviceProvider.findFirst({ where: { userId: req.user!.id } });
    if (!provider || provider.status !== 'APPROVED' || !provider.isActive) {
      return vendorNotApproved(res);
    }

    const { busId, routeId, departureDate, departureTime, arrivalTime } = parse.data;

    const bus = await prisma.bus.findUnique({ where: { id: busId } });
    if (!bus || bus.providerId !== provider.id) {
      return res.status(400).json({ error: 'Invalid bus for this operator' });
    }
    if (!bus.isActive) {
      return res.status(400).json({ error: 'Bus is not active' });
    }

    const route = await prisma.busRoute.findUnique({ where: { id: routeId } });
    if (!route || route.providerId !== provider.id) {
      return res.status(400).json({ error: 'Invalid route for this operator' });
    }
    if (!route.isActive) {
      return res.status(400).json({ error: 'Route is not active' });
    }

    const depDate = new Date(`${departureDate}T00:00:00.000Z`);
    const existing = await prisma.busTrip.findFirst({
      where: { busId, routeId, departureDate: depDate, departureTime }
    });
    if (existing) {
      return res.status(409).json({ error: 'Duplicate trip: same bus, route, date, and departure time already exists' });
    }

    const { departureTimestamp, arrivalTimestamp } = buildTimestamps(departureDate, departureTime, arrivalTime);

    const trip = await prisma.busTrip.create({
      data: {
        busId,
        routeId,
        providerId: provider.id,
        departureDate: depDate,
        departureTime,
        arrivalTime,
        departureTimestamp,
        arrivalTimestamp,
        availableSeats: parse.data.availableSeats ?? bus.totalSeats,
        pricePerSeat: parse.data.pricePerSeat,
        bookingCutoffMinutes: parse.data.bookingCutoffMinutes ?? 30,
        status: parse.data.status || 'SCHEDULED',
        isActive: true
      },
      include: {
        bus: true,
        route: true,
        provider: { select: { id: true, businessName: true, category: true } }
      }
    });

    return res.status(201).json({ message: 'Trip created successfully', trip });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/vendors/me/bus-trips
router.get('/', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const providerIds = await getVendorProviderIds(req.user!.id);
    const { status, busId, routeId, date } = req.query as Record<string, string | undefined>;

    const where: any = { providerId: { in: providerIds } };
    if (status) where.status = status;
    if (busId) where.busId = parseInt(busId, 10);
    if (routeId) where.routeId = parseInt(routeId, 10);
    if (date) {
      const d = new Date(`${date}T00:00:00.000Z`);
      const next = new Date(d);
      next.setUTCDate(next.getUTCDate() + 1);
      where.departureDate = { gte: d, lt: next };
    }

    const trips = await prisma.busTrip.findMany({
      where,
      include: {
        bus: { select: { id: true, busName: true, busType: true, registrationNumber: true, totalSeats: true } },
        route: { select: { id: true, origin: true, destination: true, distanceKm: true } },
        provider: { select: { id: true, businessName: true } }
      },
      orderBy: { departureDate: 'asc' }
    });

    return res.json({ count: trips.length, trips });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/vendors/me/bus-trips/:id
router.get('/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    if (!Number.isFinite(tripId) || tripId <= 0) {
      return res.status(400).json({ error: 'Invalid trip id' });
    }

    const { owned, trip } = await ensureTripOwnership(tripId, req.user!.id);
    if (!owned || !trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    return res.json(trip);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/vendors/me/bus-trips/:id
router.patch('/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    if (!Number.isFinite(tripId) || tripId <= 0) {
      return res.status(400).json({ error: 'Invalid trip id' });
    }

    const parse = tripUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { owned, trip, provider } = await ensureTripOwnership(tripId, req.user!.id);
    if (!owned || !trip || !provider) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (provider.status !== 'APPROVED' || !provider.isActive) {
      return vendorNotApproved(res);
    }

    const data: any = { ...parse.data };

    if (data.status) {
      const allowed = VALID_TRANSITIONS[trip.status] || [];
      if (!allowed.includes(data.status)) {
        return res.status(400).json({
          error: `Invalid status transition: ${trip.status} -> ${data.status}`
        });
      }
    }

    if (data.departureDate || data.departureTime || data.arrivalTime) {
      const depDate = data.departureDate ? new Date(data.departureDate) : trip.departureDate;
      const depTime = data.departureTime ?? trip.departureTime;
      const arrTime = data.arrivalTime ?? trip.arrivalTime;
      const { departureTimestamp, arrivalTimestamp } = buildTimestamps(
        depDate.toISOString().split('T')[0],
        depTime,
        arrTime
      );
      data.departureTimestamp = departureTimestamp;
      data.arrivalTimestamp = arrivalTimestamp;
      if (data.departureDate) {
        const d = new Date(data.departureDate);
        d.setHours(0, 0, 0, 0);
        data.departureDate = d;
      }
    }

    const updated = await prisma.busTrip.update({
      where: { id: trip.id },
      data,
      include: {
        bus: { select: { id: true, busName: true, busType: true, registrationNumber: true, totalSeats: true } },
        route: { select: { id: true, origin: true, destination: true, distanceKm: true } },
        provider: { select: { id: true, businessName: true } }
      }
    });

    return res.json({ message: 'Trip updated successfully', trip: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/vendors/me/bus-trips/:id (soft delete for SCHEDULED/OPEN, hard blocked otherwise)
router.delete('/:id', authenticateJWT, requireRole(['vendor']), async (req: AuthRequest, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    if (!Number.isFinite(tripId) || tripId <= 0) {
      return res.status(400).json({ error: 'Invalid trip id' });
    }

    const { owned, trip } = await ensureTripOwnership(tripId, req.user!.id);
    if (!owned || !trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!['SCHEDULED', 'OPEN'].includes(trip.status)) {
      return res.status(400).json({ error: `Cannot delete trip with status: ${trip.status}` });
    }

    const bookedSeats = await prisma.booking.count({
      where: { tripId: trip.id, status: { in: ['pending', 'confirmed'] } }
    });

    if (bookedSeats > 0) {
      const updated = await prisma.busTrip.update({
        where: { id: trip.id },
        data: { status: 'CANCELLED', isActive: false }
      });
      return res.json({ message: 'Trip cancelled (bookings exist)', trip: updated });
    }

    await prisma.busTrip.delete({ where: { id: trip.id } });
    return res.json({ message: 'Trip deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
