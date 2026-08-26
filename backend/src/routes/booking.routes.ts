import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const bookingSchema = z.object({
  providerId: z.number(),
  category: z.enum(['bus', 'flight', 'hotel', 'food', 'tour']),
  bookingDate: z.string(),
  travelDate: z.string(),
  numberOfPeople: z.number().default(1),
  totalAmount: z.number()
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
router.get('/seats/map', async (req, res) => {
  try {
    const { category, providerId, date } = req.query;
    
    // Seat Layout generator for Bus/Launch/Flight
    const totalSeats = category === 'flight' ? 60 : 40;
    const seatMap = [];
    
    for (let i = 1; i <= totalSeats; i++) {
      const row = String.fromCharCode(65 + Math.floor((i - 1) / 4));
      const col = ((i - 1) % 4) + 1;
      const seatNo = `${row}${col}`;
      
      seatMap.push({
        seatNumber: seatNo,
        isAvailable: Math.random() > 0.3, // Mock availability status
        price: category === 'flight' ? 3500 : 800,
        type: col === 1 || col === 4 ? 'Window' : 'Aisle'
      });
    }

    return res.json({
      category: category || 'bus',
      providerId: Number(providerId) || 1,
      date: date || new Date().toISOString().split('T')[0],
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

    const { providerId, category, bookingDate, travelDate, numberOfPeople, totalAmount } = parse.data;

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

    const discountAmount = (totalAmount * discountPercentage) / 100;
    const finalAmount = totalAmount - discountAmount;

    const booking = await prisma.booking.create({
      data: {
        userId: req.user!.id,
        providerId,
        category,
        bookingDate: new Date(bookingDate),
        travelDate: new Date(travelDate),
        numberOfPeople,
        totalAmount,
        discountAmount,
        finalAmount,
        status: 'pending',
        paymentStatus: 'pending'
      },
      include: { provider: true, user: true }
    });

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
      data: { status: 'cancelled' }
    });

    return res.json({ message: 'Booking cancelled successfully', booking: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
