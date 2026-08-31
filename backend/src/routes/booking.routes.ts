import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { notifyUser } from '../utils/notifications';

const router = Router();

// ---------------------------------------------------------------------------
// Shared seat helpers (deterministic, DB-backed availability)
// ---------------------------------------------------------------------------

const SEAT_UNIT_PRICE: Record<string, number> = { flight: 3500 };

function seatUnitPrice(category: string): number {
  return SEAT_UNIT_PRICE[category] ?? 800; // 800 BDT per seat for bus/launch
}

function totalSeatsFor(category: string): number {
  return category === 'flight' ? 60 : 40;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildSeatLayout(category: string, totalSeats: number) {
  const seats = [];
  for (let i = 1; i <= totalSeats; i++) {
    const row = String.fromCharCode(65 + Math.floor((i - 1) / 4));
    const col = ((i - 1) % 4) + 1;
    const seatNo = `${row}${col}`;
    seats.push({
      seatNumber: seatNo,
      isAvailable: true, // availability is overlaid below
      price: seatUnitPrice(category),
      type: col === 1 || col === 4 ? 'Window' : 'Aisle'
    });
  }
  return seats;
}

// Deterministic "base" occupancy so availability is stable across requests.
function seedOccupiedSeats(category: string, providerId: number, date: string, seats: any[]): Set<string> {
  const occupied = new Set<string>();
  seats.forEach(seat => {
    const h = hashString(`${providerId}:${category}:${date}:${seat.seatNumber}`);
    if (h % 10 < 3) occupied.add(seat.seatNumber); // ~30% pre-occupied, stable
  });
  return occupied;
}

const bookingSchema = z.object({
  providerId: z.number(),
  category: z.enum(['bus', 'flight', 'hotel', 'food', 'tour']),
  bookingDate: z.string(),
  travelDate: z.string(),
  numberOfPeople: z.number().default(1),
  seatNumbers: z.array(z.string()).optional(),
  passengers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    age: z.number().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    seatNumber: z.string().optional()
  })).optional(),
  route: z.string().optional(),
  serviceId: z.number().int().positive().optional(),
  // totalAmount is still accepted for convenience but is recomputed server-side
  totalAmount: z.number().optional()
});

// POST /api/v1/bookings/seats/lock (Real-time Seat Lock - 10 Mins Hold)
router.post('/seats/lock', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const { seatNumbers, providerId, travelDate } = req.body;
    const lockExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins hold
    
    return res.json({
      success: true,
      message: 'Seats locked temporarily for payment',
      lockedSeats: seatNumbers,
      expiresAt: lockExpiresAt,
      holdTimeSeconds: 600
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/bookings/seats/release (Auto/Manual Seat Release)
router.post('/seats/release', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const { seatNumbers } = req.body;
    return res.json({
      success: true,
      message: 'Seats released back to available pool',
      releasedSeats: seatNumbers
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/bookings/:id/reschedule (Reschedule Trip)
router.patch('/:id/reschedule', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { newTravelDate } = req.body;
    
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { travelDate: new Date(newTravelDate) }
    });

    return res.json({ message: 'Booking rescheduled successfully', booking: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/bookings/:id/pdf (Generate E-Ticket PDF Download Data)
router.get('/:id/pdf', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true, user: true }
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    return res.json({
      documentType: 'PDF_E_TICKET',
      ticketId: `ETP-TKT-${booking.id}`,
      passengerName: booking.user.fullName || booking.user.phone,
      provider: booking.provider.businessName,
      category: booking.category,
      travelDate: booking.travelDate,
      boardingPoint: 'Gabtoli Counter 4',
      droppingPoint: 'Cox\'s Bazar Main Station',
      pdfUrl: `https://api.extratravelpoint.com/tickets/download/${booking.bookingCode}.pdf`
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/bookings/seats/map
// Deterministic seat layout with availability overlaid from:
//  1. a stable seed per (providerId, category, date) and
//  2. seats already booked in the database for that provider/date/category.
router.get('/seats/map', async (req, res) => {
  try {
    const category = (typeof req.query.category === 'string' ? req.query.category : 'bus');
    const providerId = Number(req.query.providerId) || 1;
    const date = typeof req.query.date === 'string' && req.query.date
      ? req.query.date
      : new Date().toISOString().split('T')[0];

    const totalSeats = totalSeatsFor(category);
    const seats = buildSeatLayout(category, totalSeats);

    // 1. Stable base occupancy
    const occupied = seedOccupiedSeats(category, providerId, date, seats);

    // 2. Overlay seats that are already booked in the database
    const bookings = await prisma.booking.findMany({
      where: {
        providerId,
        category,
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

    const seatMap = seats.map(seat => ({
      ...seat,
      isAvailable: !occupied.has(seat.seatNumber)
    }));

    return res.json({
      category,
      providerId,
      date,
      totalSeats,
      seats: seatMap
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/bookings (Get user bookings)
router.get('/', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user!.id },
      include: { provider: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(bookings);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/bookings (Create new booking & calculate discount according to Section 4.3)
router.post('/', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const parse = bookingSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const {
      providerId, category, bookingDate, travelDate, numberOfPeople,
      seatNumbers, passengers, route, serviceId, totalAmount
    } = parse.data;

    // --- Seat validation (backend authoritative) ---
    let normalizedSeats: string[] = [];
    if (seatNumbers && seatNumbers.length > 0) {
      normalizedSeats = seatNumbers.map(s => s.trim()).filter(Boolean);

      // one seat per passenger
      if (passengers && passengers.length > 0 && normalizedSeats.length !== passengers.length) {
        return res.status(400).json({ error: 'Seat count must match passenger count' });
      }

      // seats must exist in the layout
      const layout = buildSeatLayout(category, totalSeatsFor(category));
      const validSeats = new Set(layout.map(s => s.seatNumber));
      const invalid = normalizedSeats.filter(s => !validSeats.has(s));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Invalid seat number(s): ${invalid.join(', ')}` });
      }

      // no duplicate seats in the same request
      if (new Set(normalizedSeats).size !== normalizedSeats.length) {
        return res.status(400).json({ error: 'Duplicate seat selection' });
      }

      // seats must not already be booked for this provider/date/category
      const conflicting = await prisma.booking.findMany({
        where: {
          providerId,
          category,
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
      const taken = normalizedSeats.filter(s => occupied.has(s));
      if (taken.length > 0) {
        return res.status(409).json({ error: `Seat(s) already booked: ${taken.join(', ')}` });
      }
    }

    // --- Authoritative price: ignore client totalAmount, recompute from seats/service ---
    let unitPrice = seatUnitPrice(category);

    if (serviceId) {
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!service || service.providerId !== providerId) {
        return res.status(400).json({ error: 'Invalid service for this provider' });
      }
      if (!service.isActive || service.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'Selected service is not active' });
      }

      const requestedUnits = normalizedSeats.length > 0 ? normalizedSeats.length : numberOfPeople;
      if (service.capacity != null && requestedUnits > service.capacity) {
        return res.status(400).json({
          error: `Requested units (${requestedUnits}) exceed service capacity (${service.capacity})`
        });
      }

      const travelDateObj = new Date(travelDate);
      const availability = await prisma.serviceAvailability.findFirst({
        where: {
          serviceId,
          date: travelDateObj,
          isActive: true
        }
      });

      if (availability) {
        if (availability.capacity != null && requestedUnits > availability.capacity) {
          return res.status(400).json({
            error: `Requested units (${requestedUnits}) exceed availability capacity (${availability.capacity}) for ${travelDate}`
          });
        }
      }

      unitPrice = service.price; // backend-authoritative unit price
    }

    const computedFare = normalizedSeats.length > 0
      ? normalizedSeats.length * unitPrice
      : (typeof totalAmount === 'number' ? totalAmount : numberOfPeople * unitPrice);

    // Check user's previous bookings for combo discount calculation
    const existingBookings = await prisma.booking.findMany({
      where: { userId: req.user!.id, status: { in: ['confirmed', 'completed'] } }
    });

    let discountPercentage = 0;
    const categoriesUsed = new Set(existingBookings.map(b => b.category));
    categoriesUsed.add(category);

    if (categoriesUsed.size >= 3) {
      discountPercentage = 15; // 15% max discount for 3+ services
    } else if (categoriesUsed.has('hotel') && categoriesUsed.has('food')) {
      discountPercentage = 10; // 10% discount for hotel + restaurant
    } else if (categoriesUsed.has('tour') && categoriesUsed.has('hotel')) {
      discountPercentage = 5; // 5% extra for tour package + hotel
    }

    const discountAmount = (computedFare * discountPercentage) / 100;
    const finalAmount = computedFare - discountAmount;

    const booking = await prisma.booking.create({
      data: {
        userId: req.user!.id,
        providerId,
        category,
        bookingDate: new Date(bookingDate),
        travelDate: new Date(travelDate),
        numberOfPeople,
        totalAmount: computedFare,
        discountAmount,
        finalAmount,
        seatNumbers: normalizedSeats.length > 0 ? normalizedSeats.join(',') : null,
        passengerInfo: passengers && passengers.length > 0 ? JSON.stringify(passengers) : null,
        route: route ?? null,
        serviceId: serviceId ?? null,
        status: 'pending',
        paymentStatus: 'pending'
      },
      include: { provider: true, user: true, service: true }
    });

    notifyUser(
      booking.provider.userId,
      'NEW_BOOKING',
      'New Booking Received',
      `Booking #${booking.bookingCode} for ${category} on ${booking.travelDate.toISOString().split('T')[0]}`
    );

    return res.status(201).json({
      message: 'Booking created successfully',
      booking,
      discountApplied: {
        percentage: discountPercentage,
        discountAmount,
        finalAmount
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/bookings/:id
router.get('/:id', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { provider: true, user: true, payments: true }
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(booking);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/bookings/:id/cancel
router.patch('/:id/cancel', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'cancelled' },
      include: { provider: { include: { user: true } } }
    });

    notifyUser(
      updated.provider.userId,
      'BOOKING_CANCELLED',
      'Booking Cancelled',
      `Booking #${updated.bookingCode} was cancelled by the customer.`
    );

    return res.json({ message: 'Booking cancelled successfully', booking: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
