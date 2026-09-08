import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();

const tripSearchSchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date format' }).optional(),
  busType: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0)
});

// GET /api/v1/transport/trips
router.get('/', async (req, res) => {
  try {
    const parse = tripSearchSchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { origin, destination, date, busType, limit, offset } = parse.data;

    const where: any = { isActive: true, status: { in: ['SCHEDULED', 'OPEN'] } };

    if (origin) {
      where.route = { origin: { equals: origin } };
    }
    if (destination) {
      where.route = { destination: { equals: destination } };
    }
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.departureDate = { gte: d, lt: next };
    }
    if (busType) {
      where.bus = { busType };
    }

    const trips = await prisma.busTrip.findMany({
      where,
      include: {
        bus: {
          select: {
            id: true,
            busName: true,
            busType: true,
            registrationNumber: true,
            totalSeats: true,
            amenities: true
          }
        },
        route: {
          select: {
            id: true,
            origin: true,
            destination: true,
            distanceKm: true,
            estimatedDurationMinutes: true
          }
        },
        provider: {
          select: {
            id: true,
            businessName: true,
            city: true,
            isVerified: true,
            rating: true,
            totalReviews: true,
            phone: true,
            address: true
          }
        }
      },
      orderBy: { departureTimestamp: 'asc' },
      take: limit,
      skip: offset
    });

    return res.json({
      count: trips.length,
      trips: trips.map(t => ({
        id: t.id,
        departureDate: t.departureDate.toISOString().split('T')[0],
        departureTime: t.departureTime,
        arrivalTime: t.arrivalTime,
        status: t.status,
        availableSeats: t.availableSeats,
        pricePerSeat: t.pricePerSeat,
        bookingCutoffMinutes: t.bookingCutoffMinutes,
        bus: t.bus,
        route: t.route,
        provider: t.provider
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/transport/trips/:id
router.get('/:id', async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    if (!Number.isFinite(tripId) || tripId <= 0) {
      return res.status(400).json({ error: 'Invalid trip id' });
    }

    const trip = await prisma.busTrip.findUnique({
      where: { id: tripId },
      include: {
        bus: {
          select: {
            id: true,
            busName: true,
            busType: true,
            registrationNumber: true,
            totalSeats: true,
            amenities: true
          }
        },
        route: {
          select: {
            id: true,
            origin: true,
            destination: true,
            distanceKm: true,
            estimatedDurationMinutes: true
          }
        },
        provider: {
          select: {
            id: true,
            businessName: true,
            city: true,
            isVerified: true,
            rating: true,
            totalReviews: true,
            phone: true,
            address: true
          }
        }
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    return res.json({
      id: trip.id,
      departureDate: trip.departureDate.toISOString().split('T')[0],
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      departureTimestamp: trip.departureTimestamp,
      arrivalTimestamp: trip.arrivalTimestamp,
      status: trip.status,
      availableSeats: trip.availableSeats,
      pricePerSeat: trip.pricePerSeat,
      bookingCutoffMinutes: trip.bookingCutoffMinutes,
      bus: trip.bus,
      route: trip.route,
      provider: trip.provider
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
