import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { z } from 'zod';
import { notifyUser } from '../utils/notifications';

const router = Router();

// Zod validation schemas
const flightCreateSchema = z.object({
  providerId: z.number().int().positive(),
  flightNumber: z.string().min(2).max(20),
  origin: z.string().min(2).max(100),
  destination: z.string().min(2).max(100),
  departureTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid departure time format' }),
  arrivalTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid arrival time format' }),
  duration: z.number().int().positive().optional(),
  aircraftType: z.string().max(50).optional(),
  capacity: z.number().int().positive(),
  price: z.number().nonnegative(),
  currency: z.string().length(3).optional().default('BDT'),
});

const flightUpdateSchema = flightCreateSchema.partial();

const flightSearchSchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  departureDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional(),
  returnDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional(),
  passengers: z.coerce.number().int().positive().optional().default(1),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  providerId: z.coerce.number().int().positive().optional(),
  status: z.string().optional().default('scheduled'),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

const flightBookingSchema = z.object({
  flightId: z.number().int().positive(),
  passengerCount: z.number().int().positive(),
  totalAmount: z.number().nonnegative(),
  passengerInfo: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(10),
  }),
});

const flightStatusUpdateSchema = z.object({
  status: z.enum(['scheduled', 'boarding', 'departed', 'arrived', 'cancelled']),
});

// Helper: Get vendor's provider IDs
async function getVendorProviderIds(userId: number): Promise<number[]> {
  const providers = await prisma.serviceProvider.findMany({
    where: { userId },
    select: { id: true }
  });
  return providers.map(p => p.id);
}

// Helper: Ensure flight ownership
async function ensureFlightOwnership(flightId: number, userId: number): Promise<boolean> {
  const flight = await prisma.flight.findUnique({
    where: { id: flightId },
    include: { provider: { select: { userId: true } } }
  });
  return !!flight && flight.provider.userId === userId;
}

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

// GET /api/v1/flights/search - Search flights
router.get('/search', async (req, res) => {
  try {
    const parse = flightSearchSchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const {
      origin, destination, departureDate, returnDate, passengers,
      minPrice, maxPrice, providerId, status, limit, offset
    } = parse.data;

    const where: any = { isActive: true };

    if (origin) where.origin = { contains: origin };
    if (destination) where.destination = { contains: destination };
    if (providerId) where.providerId = providerId;
    if (status) where.status = status;

    if (departureDate) {
      const startOfDay = new Date(departureDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(departureDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.departureTime = { gte: startOfDay, lte: endOfDay };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = minPrice;
      if (maxPrice) where.price.lte = maxPrice;
    }

    const flights = await prisma.flight.findMany({
      where,
      include: {
        provider: {
          select: { id: true, businessName: true, category: true, isVerified: true }
        }
      },
      orderBy: { departureTime: 'asc' },
      take: limit,
      skip: offset,
    });

    // Filter by available seats
    const availableFlights = flights.filter(f => f.availableSeats >= (passengers || 1));

    return res.json({
      count: availableFlights.length,
      flights: availableFlights
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/flights/:id - Flight details
router.get('/:id', async (req, res) => {
  try {
    const flightId = parseInt(req.params.id);
    if (!Number.isFinite(flightId) || flightId <= 0) {
      return res.status(400).json({ error: 'Invalid flight ID' });
    }

    const flight = await prisma.flight.findUnique({
      where: { id: flightId },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            category: true,
            isVerified: true,
            phone: true,
            address: true,
            city: true
          }
        }
      }
    });

    if (!flight) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    return res.json(flight);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CUSTOMER ENDPOINTS
// ============================================================================

// POST /api/v1/flights/book - Book a flight
router.post('/book', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const parse = flightBookingSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { flightId, passengerCount, totalAmount, passengerInfo } = parse.data;

    // Check flight exists and is bookable
    const flight = await prisma.flight.findUnique({
      where: { id: flightId },
      include: { provider: true }
    });

    if (!flight) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    if (!flight.isActive) {
      return res.status(400).json({ error: 'Flight is not active' });
    }

    if (flight.status !== 'scheduled') {
      return res.status(400).json({ error: `Flight is ${flight.status} and cannot be booked` });
    }

    if (flight.availableSeats < passengerCount) {
      return res.status(409).json({ error: `Only ${flight.availableSeats} seats available` });
    }

    // Validate price
    const expectedAmount = flight.price * passengerCount;
    if (totalAmount !== expectedAmount) {
      return res.status(400).json({ error: `Invalid amount. Expected ${expectedAmount} ${flight.currency}` });
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId: req.user!.id,
        providerId: flight.providerId,
        flightId: flight.id,
        category: 'flight',
        bookingDate: new Date(),
        travelDate: flight.departureTime,
        numberOfPeople: passengerCount,
        totalAmount,
        discountAmount: 0,
        finalAmount: totalAmount,
        status: 'pending',
        paymentStatus: 'pending',
        route: `${flight.origin} -> ${flight.destination}`,
        passengerInfo: JSON.stringify(passengerInfo),
      },
      include: { provider: true, user: true, flight: true }
    });

    // Update available seats
    await prisma.flight.update({
      where: { id: flightId },
      data: { availableSeats: { decrement: passengerCount } }
    });

    // Send notification to vendor
    await notifyUser(
      flight.provider.userId,
      'NEW_BOOKING',
      'New Flight Booking',
      `Booking ${booking.bookingCode} for ${flight.flightNumber} on ${flight.departureTime.toISOString().split('T')[0]}`
    );

    return res.status(201).json({
      message: 'Flight booked successfully',
      booking: {
        id: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        flight: {
          id: flight.id,
          flightNumber: flight.flightNumber,
          origin: flight.origin,
          destination: flight.destination,
          departureTime: flight.departureTime,
          arrivalTime: flight.arrivalTime,
        },
        provider: {
          id: flight.provider.id,
          businessName: flight.provider.businessName,
        },
        passengerCount: booking.numberOfPeople,
        totalAmount: booking.totalAmount,
        finalAmount: booking.finalAmount,
        paymentStatus: booking.paymentStatus,
        createdAt: booking.createdAt,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/flights/bookings/:id/confirmation - Booking confirmation
router.get('/bookings/:id/confirmation', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        flight: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.category !== 'flight') {
      return res.status(400).json({ error: 'This is not a flight booking' });
    }

    return res.json({
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      flight: booking.flight ? {
        id: booking.flight.id,
        flightNumber: booking.flight.flightNumber,
        origin: booking.flight.origin,
        destination: booking.flight.destination,
        departureTime: booking.flight.departureTime,
        arrivalTime: booking.flight.arrivalTime,
      } : null,
      provider: {
        id: booking.provider.id,
        businessName: booking.provider.businessName,
      },
      passenger: {
        id: booking.user.id,
        fullName: booking.user.fullName,
        email: booking.user.email,
        phone: booking.user.phone,
      },
      passengerCount: booking.numberOfPeople,
      totalAmount: booking.totalAmount,
      finalAmount: booking.finalAmount,
      paymentStatus: booking.paymentStatus,
      travelDate: booking.travelDate,
      createdAt: booking.createdAt,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/flights/bookings/:id/status - Booking status
router.get('/bookings/:id/status', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        flight: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      category: booking.category,
      travelDate: booking.travelDate,
      flight: booking.flight ? {
        flightNumber: booking.flight.flightNumber,
        origin: booking.flight.origin,
        destination: booking.flight.destination,
        departureTime: booking.flight.departureTime,
        status: booking.flight.status,
      } : null,
      updatedAt: booking.updatedAt,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/flights/bookings/:id/cancel - Cancel booking
router.patch('/bookings/:id/cancel', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { flight: true, provider: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.category !== 'flight') {
      return res.status(400).json({ error: 'This is not a flight booking' });
    }

    // Only allow cancellation if booking is pending or confirmed
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        error: `Cannot cancel booking with status: ${booking.status}`
      });
    }

    // Release seats back to flight
    if (booking.flightId) {
      await prisma.flight.update({
        where: { id: booking.flightId },
        data: { availableSeats: { increment: booking.numberOfPeople } }
      });
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date()
      },
      include: { provider: true, user: true, flight: true }
    });

    // Notify vendor about cancellation
    if (booking.provider && booking.provider.userId && booking.provider.userId !== req.user!.id) {
      await notifyUser(
        booking.provider.userId,
        'BOOKING_CANCELLED',
        'Flight Booking Cancelled',
        `Booking ${updated.bookingCode} for flight ${booking.flight?.flightNumber ?? ''} has been cancelled by the customer.`
      );
    }

    return res.json({
      message: 'Flight booking cancelled successfully',
      booking: {
        id: updated.id,
        bookingCode: updated.bookingCode,
        status: updated.status,
        cancelledAt: updated.cancelledAt,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// VENDOR ENDPOINTS
// ============================================================================

// POST /api/v1/flights - Create flight (vendor)
router.post('/', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const parse = flightCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { providerId, flightNumber, origin, destination, departureTime, arrivalTime, duration, aircraftType, capacity, price, currency } = parse.data;

    // Validate dates
    const depTime = new Date(departureTime);
    const arrTime = new Date(arrivalTime);

    if (depTime >= arrTime) {
      return res.status(400).json({ error: 'Departure time must be before arrival time' });
    }

    if (origin.toLowerCase() === destination.toLowerCase()) {
      return res.status(400).json({ error: 'Origin and destination cannot be the same' });
    }

    // Check provider ownership
    const vendorProviderIds = await getVendorProviderIds(req.user!.id);

    if (!vendorProviderIds.includes(providerId)) {
      return res.status(403).json({ error: 'You can only create flights for your own airline' });
    }

    const provider = await prisma.serviceProvider.findUnique({ where: { id: providerId } });
    if (!provider || provider.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Only approved airlines can publish flights' });
    }

    // Check for duplicate flight number for this provider
    const existing = await prisma.flight.findFirst({
      where: { providerId, flightNumber }
    });
    if (existing) {
      return res.status(409).json({ error: 'Flight number already exists for this airline' });
    }

    const flight = await prisma.flight.create({
      data: {
        providerId,
        flightNumber,
        origin,
        destination,
        departureTime: depTime,
        arrivalTime: arrTime,
        duration,
        aircraftType,
        capacity,
        availableSeats: capacity,
        price,
        currency: currency || 'BDT',
        status: 'scheduled',
        isActive: true,
      },
      include: { provider: true }
    });

    return res.status(201).json({
      message: 'Flight created successfully',
      flight
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/flights/:id - Update flight (vendor)
router.patch('/:id', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const flightId = parseInt(req.params.id);
    if (!Number.isFinite(flightId) || flightId <= 0) {
      return res.status(400).json({ error: 'Invalid flight ID' });
    }

    const parse = flightUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    // Check ownership
    const isOwner = await ensureFlightOwnership(flightId, req.user!.id);
    if (!isOwner && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const data: Record<string, any> = { ...parse.data };
    if (data.departureTime) data.departureTime = new Date(data.departureTime);
    if (data.arrivalTime) data.arrivalTime = new Date(data.arrivalTime);

    // Validate dates if both provided
    if (data.departureTime && data.arrivalTime && data.departureTime >= data.arrivalTime) {
      return res.status(400).json({ error: 'Departure time must be before arrival time' });
    }

    // Validate origin/destination if either field is being updated
    const existing = await prisma.flight.findUnique({ where: { id: flightId } });
    if (!existing) {
      return res.status(404).json({ error: 'Flight not found' });
    }
    const finalOrigin = (data.origin ?? existing.origin) as string;
    const finalDestination = (data.destination ?? existing.destination) as string;
    if (finalOrigin.toLowerCase() === finalDestination.toLowerCase()) {
      return res.status(400).json({ error: 'Origin and destination cannot be the same' });
    }

    // If capacity changes, update availableSeats proportionally
    if (data.capacity) {
      const booked = existing.capacity - existing.availableSeats;
      if (data.capacity < booked) {
        return res.status(400).json({ error: 'New capacity cannot be less than booked seats' });
      }
      data.availableSeats = data.capacity - booked;
    }

    const flight = await prisma.flight.update({
      where: { id: flightId },
      data,
      include: { provider: true }
    });

    return res.json({
      message: 'Flight updated successfully',
      flight
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/flights - List vendor's flights
router.get('/', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await getVendorProviderIds(req.user!.id);

    const flights = await prisma.flight.findMany({
      where: { providerId: { in: vendorProviderIds } },
      include: { provider: true },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      count: flights.length,
      flights
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/flights/:id/status - Update flight status (vendor)
router.patch('/:id/status', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const flightId = parseInt(req.params.id);
    if (!Number.isFinite(flightId) || flightId <= 0) {
      return res.status(400).json({ error: 'Invalid flight ID' });
    }

    const parse = flightStatusUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    // Check ownership
    const isOwner = await ensureFlightOwnership(flightId, req.user!.id);
    if (!isOwner && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status } = parse.data;

    // Validate status transitions
    const currentFlight = await prisma.flight.findUnique({ where: { id: flightId } });
    if (!currentFlight) {
      return res.status(404).json({ error: 'Flight not found' });
    }

    const validTransitions: Record<string, string[]> = {
      scheduled: ['boarding', 'cancelled'],
      boarding: ['departed', 'cancelled'],
      departed: ['arrived', 'cancelled'],
      arrived: [],
      cancelled: []
    };

    const allowed = validTransitions[currentFlight.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition: ${currentFlight.status} -> ${status}`
      });
    }

    const flight = await prisma.flight.update({
      where: { id: flightId },
      data: { status },
      include: { provider: true }
    });

    // Notify affected bookings if cancelled
    if (status === 'cancelled') {
      const bookings = await prisma.booking.findMany({
        where: { flightId, status: { in: ['pending', 'confirmed'] } },
        include: { user: true }
      });

      for (const booking of bookings) {
        await notifyUser(
          booking.userId,
          'FLIGHT_CANCELLED',
          'Flight Cancelled',
          `Your flight ${flight.flightNumber} has been cancelled.`
        );
      }
    }

    return res.json({
      message: `Flight status updated to ${status}`,
      flight
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
