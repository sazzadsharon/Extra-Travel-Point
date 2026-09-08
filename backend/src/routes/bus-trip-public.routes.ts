import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();

const BUS_TOTAL_SEATS = 40;

interface SeatMapSeat {
  seatNumber: string;
  isAvailable: boolean;
  price: number;
  type: 'Window' | 'Aisle';
  isLocked?: boolean;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildBusSeatLayout(totalSeats: number): SeatMapSeat[] {
  const seats: SeatMapSeat[] = [];
  for (let i = 1; i <= totalSeats; i++) {
    const row = String.fromCharCode(65 + Math.floor((i - 1) / 4));
    const col = ((i - 1) % 4) + 1;
    seats.push({
      seatNumber: `${row}${col}`,
      isAvailable: true,
      price: 0,
      type: col === 1 || col === 4 ? 'Window' : 'Aisle'
    });
  }
  return seats;
}

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

// GET /api/v1/transport/trips/:id/seats?date=YYYY-MM-DD
router.get('/:id/seats', async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    if (!Number.isFinite(tripId) || tripId <= 0) {
      return res.status(400).json({ error: 'Invalid trip id' });
    }

    const date = typeof req.query.date === 'string' && req.query.date
      ? req.query.date
      : new Date().toISOString().split('T')[0];

    const trip = await prisma.busTrip.findUnique({
      where: { id: tripId },
      include: {
        bus: true,
        provider: true
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const totalSeats = trip.bus?.totalSeats ?? BUS_TOTAL_SEATS;
    const seats = buildBusSeatLayout(totalSeats);
    const unitPrice = trip.pricePerSeat ?? 0;

    const occupied = new Set<string>();

    // 1. Stable base occupancy (deterministic hash)
    seats.forEach(seat => {
      const h = hashString(`${trip.id}:trip:${date}:${seat.seatNumber}`);
      if (h % 10 < 3) occupied.add(seat.seatNumber);
    });

    // 2. Overlay seats already booked for this specific trip on this date
    const bookings = await prisma.booking.findMany({
      where: {
        tripId: trip.id,
        status: { in: ['confirmed', 'pending'] }
      },
      select: { travelDate: true, seatNumbers: true }
    });

    for (const b of bookings) {
      const bDate = b.travelDate.toISOString().split('T')[0];
      if (bDate !== date) continue;
      if (!b.seatNumbers) continue;
      b.seatNumbers.split(',').forEach(s => occupied.add(s.trim()));
    }

    // 3. Overlay active in-flight seat locks held by other customers
    const now = new Date();
    const activeLocks = await prisma.seatLock.findMany({
      where: {
        providerId: trip.providerId,
        category: 'bus',
        travelDate: new Date(date),
        releasedAt: null,
        expiresAt: { gt: now }
      },
      select: { seatNumber: true }
    });
    const locked = new Set(activeLocks.map(l => l.seatNumber));

    const seatMap = seats.map(seat => ({
      seatNumber: seat.seatNumber,
      isAvailable: !occupied.has(seat.seatNumber),
      isLocked: locked.has(seat.seatNumber) && !occupied.has(seat.seatNumber),
      price: unitPrice,
      type: seat.type
    }));

    const availableCount = seatMap.filter(s => s.isAvailable).length;

    return res.json({
      busId: trip.id,
      date,
      totalSeats,
      availableSeats: availableCount,
      pricePerSeat: unitPrice,
      currency: 'BDT',
      seats: seatMap
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
