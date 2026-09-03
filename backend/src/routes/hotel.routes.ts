import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { resolveCommissionRate } from '../utils/commission';
import { z } from 'zod';
import { verifyHmacSignature } from '../utils/qr';

const router = Router();

function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const curr = new Date(startDate);
  curr.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (curr < end) {
    dates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

// Input validation for hotel search/filter
const hotelSearchSchema = z.object({
  city: z.string().optional(),
  providerId: z.coerce.number().int().positive().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional()
});

// 1. Hotel listing/search (public)
router.get('/search', async (req, res) => {
  try {
    const parse = hotelSearchSchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }
    const { city, providerId, rating, minPrice, maxPrice } = parse.data;

    const where: any = { category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED' };
    if (city) where.city = city;
    if (providerId) where.id = providerId;

    const hotels = await prisma.serviceProvider.findMany({
      where,
      include: {
        rooms: {
          include: {
            availabilities: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Apply price & availability filter based on rooms
    const filteredHotels = hotels.map(hotel => {
      const rooms = hotel.rooms || [];
      const prices = rooms.map(room => room.price);
      const minRoomPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxRoomPrice = prices.length > 0 ? Math.max(...prices) : 0;

      if (minPrice && minRoomPrice < minPrice) return null;
      if (maxPrice && maxRoomPrice > maxPrice) return null;
      if (rating && hotel.rating && hotel.rating < rating) return null;

      return {
        id: hotel.id,
        businessName: hotel.businessName,
        category: hotel.category,
        description: hotel.description,
        address: hotel.address,
        city: hotel.city,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        isVerified: hotel.isVerified,
        rating: hotel.rating,
        totalReviews: hotel.totalReviews,
        phone: hotel.phone,
        commissionRate: hotel.commissionRate,
        rooms: rooms.map(room => ({
          id: room.id,
          name: room.name,
          type: room.type,
          description: room.description,
          price: room.price,
          capacity: room.capacity,
          totalRooms: room.totalRooms,
          amenities: room.amenities,
          images: room.images,
          isAvailable: room.isAvailable
        }))
      };
    }).filter(hotel => hotel !== null);

    return res.json({
      count: filteredHotels.length,
      hotels: filteredHotels
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 2. Hotel details (public)
router.get('/details/:hotelId', async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    if (!Number.isFinite(hotelId) || hotelId <= 0) {
      return res.status(400).json({ error: 'Invalid hotel id' });
    }

    const hotel = await prisma.serviceProvider.findFirst({
      where: { id: hotelId, category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED' },
      include: {
        rooms: {
          include: {
            availabilities: true
          }
        }
      }
    });

    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    return res.json({
      id: hotel.id,
      businessName: hotel.businessName,
      category: hotel.category,
      description: hotel.description,
      address: hotel.address,
      city: hotel.city,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
      isVerified: hotel.isVerified,
      rating: hotel.rating,
      totalReviews: hotel.totalReviews,
      phone: hotel.phone,
      commissionRate: hotel.commissionRate,
      rooms: hotel.rooms.map(room => ({
        id: room.id,
        name: room.name,
        type: room.type,
        description: room.description,
        price: room.price,
        capacity: room.capacity,
        totalRooms: room.totalRooms,
        amenities: room.amenities,
        images: room.images,
        isAvailable: room.isAvailable,
        availabilities: room.availabilities.map(avail => ({
          date: avail.date.toISOString().split('T')[0],
          totalRooms: avail.totalRooms,
          bookedRooms: avail.bookedRooms,
          isActive: avail.isActive
        }))
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Room type management (vendor only)
const roomCreateSchema = z.object({
  hotelId: z.number().int().positive(),
  name: z.string().min(2).max(200),
  type: z.string().min(1).max(100),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  capacity: z.number().int().positive().default(2),
  totalRooms: z.number().int().positive().optional().default(1),
  amenities: z.string().optional(),
  images: z.string().optional(),
  isAvailable: z.boolean().optional().default(true)
});

router.post('/rooms', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const parse = roomCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { hotelId, name, type, description, price, capacity, totalRooms, amenities, images, isAvailable } = parse.data;

    // Check if hotel exists, belongs to the hotel category, and is owned by the vendor
    const hotel = await prisma.serviceProvider.findUnique({
      where: { id: hotelId }
    });
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    if (hotel.category !== 'hotel') {
      return res.status(400).json({ error: 'Invalid hotel type' });
    }

    if (hotel.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const room = await prisma.room.create({
      data: {
        providerId: hotelId,
        name,
        type,
        description,
        price,
        capacity,
        totalRooms,
        amenities,
        images,
        isAvailable
      }
    });

    return res.status(201).json({
      message: 'Room created successfully',
      room
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// List rooms for a hotel (public)
router.get('/rooms', async (req, res) => {
  try {
    const hotelId = req.query.hotelId ? parseInt(req.query.hotelId as string) : null;
    const where: any = {};
    if (hotelId) where.providerId = hotelId;
    const rooms = await prisma.room.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json({ count: rooms.length, rooms });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. Room availability management (vendor only)
const availabilityCreateSchema = z.object({
  roomId: z.number().int().positive(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }),
  totalRooms: z.number().int().positive(),
  isActive: z.boolean().optional().default(true)
});

router.post('/rooms/:roomId/availability', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return res.status(400).json({ error: 'Invalid room id' });
    }

    const parse = availabilityCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { date, totalRooms, isActive } = parse.data;

    // Check room ownership
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hotel = await prisma.serviceProvider.findUnique({
      where: { id: room.providerId }
    });
    if (!hotel || hotel.category !== 'hotel') {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    if (hotel.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    // Upsert by composite unique (roomId, date)
    const availability = await prisma.hotelAvailability.upsert({
      where: { roomId_date: { roomId, date: dateObj } },
      update: { totalRooms, isActive },
      create: { roomId, date: dateObj, totalRooms, bookedRooms: 0, isActive }
    });

    return res.status(201).json({
      message: 'Availability saved successfully',
      availability
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Get room availability for a date range (public)
router.get('/rooms/:roomId/availability', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return res.status(400).json({ error: 'Invalid room id' });
    }
    const { from, to } = req.query;
    const where: any = { roomId };
    if (from && to) {
      const fromDate = new Date(String(from));
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(String(to));
      toDate.setHours(23, 59, 59, 999);
      where.date = { gte: fromDate, lte: toDate };
    }
    const availabilities = await prisma.hotelAvailability.findMany({ where, orderBy: { date: 'asc' } });
    return res.json({ count: availabilities.length, availabilities });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. Check-in & Check-out handling (vendor only, with QR support)
router.post('/check-in', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    let bookingId = req.body.bookingId ? Number(req.body.bookingId) : null;
    const rawQr = req.body.qrData || req.body.qrToken;

    if (rawQr && !bookingId) {
      let qrObj = rawQr;
      if (typeof rawQr === 'string') {
        try { qrObj = JSON.parse(rawQr); }
        catch { return res.status(400).json({ error: 'Invalid QR JSON format' }); }
      }
      const payload = qrObj?.payload;
      const signature = qrObj?.signature;

      if (!payload || !signature) {
        return res.status(400).json({ error: 'Missing QR payload or signature' });
      }

      if (!verifyHmacSignature(payload, signature)) {
        return res.status(400).json({ error: 'Invalid QR HMAC signature' });
      }

      const bookingCode = payload.bkg;
      const token = payload.tp;
      const bookingFound = await prisma.booking.findFirst({
        where: { bookingCode, qrToken: token }
      });
      if (!bookingFound) {
        return res.status(404).json({ error: 'Booking not found for provided QR token' });
      }
      bookingId = bookingFound.id;
    }

    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId or valid QR data is required' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true, user: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.provider.category !== 'hotel') {
      return res.status(400).json({ error: 'Booking is not a hotel booking' });
    }

    if (booking.provider.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot check in a cancelled booking' });
    }

    // Verify payment is confirmed
    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'Cannot check in: payment not confirmed' });
    }

    // Check if already completed
    if (booking.status === 'completed') {
      return res.status(400).json({ error: 'Booking already checked out' });
    }

    // Check if already checked in (status is 'confirmed' and has QR log today)
    if (booking.status === 'confirmed') {
      const existingQrLog = await prisma.qrLog.findFirst({
        where: {
          bookingId: booking.id,
          scannedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      });
      if (existingQrLog) {
        return res.status(400).json({ error: 'Booking already checked in' });
      }
    }

    // Check if booking is eligible for check-in (must be 'pending' or 'confirmed' with paid status)
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot check in booking with status: ${booking.status}` });
    }

    // Check for duplicate QR scan (replay protection)
    const existingQrLog = await prisma.qrLog.findFirst({
      where: {
        bookingId: booking.id,
        scannedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    });
    if (existingQrLog) {
      return res.status(409).json({ error: 'QR already used for check-in today' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update booking status to confirmed (checked in)
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'confirmed' }
      });

      // Create QR audit log
      const qrLog = await tx.qrLog.create({
        data: {
          bookingId: booking.id,
          userId: booking.userId,
          providerId: booking.providerId,
          qrToken: booking.qrToken || '',
          discountType: 'hotel_checkin',
          discountValue: 0,
          isUsed: true
        }
      });

      return { updated, qrLog };
    });

    return res.json({
      message: `Check-in successful for booking #${booking.bookingCode}`,
      booking: result.updated,
      checkedInAt: result.qrLog.scannedAt,
      guestName: booking.user.fullName || booking.user.phone
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/check-out', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const bookingId = req.body.bookingId ? Number(req.body.bookingId) : null;
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.provider.category !== 'hotel') {
      return res.status(400).json({ error: 'Booking is not a hotel booking' });
    }

    if (booking.provider.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot check out a cancelled booking' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ error: 'Booking already checked out' });
    }

    // Must be checked in (confirmed) to check out
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Guest must be checked in before check-out' });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'completed', completedAt: new Date() }
    });

    return res.json({
      message: `Check-out successful for booking #${booking.bookingCode}`,
      booking: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 6. Hotel booking (customer) with full double-booking prevention
const hotelBookingSchema = z.object({
  hotelId: z.number().int().positive(),
  roomId: z.number().int().positive(),
  checkInDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid check-in date' }),
  checkOutDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid check-out date' }),
  numberOfGuests: z.number().int().positive(),
  totalAmount: z.number().nonnegative(),
  customerInfo: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(10)
  })
});

router.post('/book', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const parse = hotelBookingSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { hotelId, roomId, checkInDate, checkOutDate, numberOfGuests, totalAmount, customerInfo } = parse.data;

    // Check if hotel exists and is approved
    const hotel = await prisma.serviceProvider.findFirst({
      where: { id: hotelId, category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED' }
    });
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found or not approved' });
    }

    // Check if room exists and belongs to the hotel
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });
    if (!room || room.providerId !== hotelId) {
      return res.status(404).json({ error: 'Room not found or does not belong to this hotel' });
    }

    // Validate dates
    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(checkOutDate);
    checkOut.setHours(0, 0, 0, 0);

    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date' });
    }

    if (numberOfGuests > room.capacity) {
      return res.status(400).json({ error: `Number of guests (${numberOfGuests}) exceeds room capacity (${room.capacity})` });
    }

    const nights = getDatesInRange(checkIn, checkOut);
    if (nights.length === 0) {
      return res.status(400).json({ error: 'At least one night stay required' });
    }

    // Use transaction for concurrency & double-booking prevention
    const booking = await prisma.$transaction(async (tx) => {
      // Check room availability for each night in range
      for (const d of nights) {
        const activeBookings = await tx.booking.findMany({
          where: {
            roomId,
            status: { in: ['confirmed', 'pending', 'paid', 'completed'] },
            travelDate: { lte: d },
            returnDate: { gt: d }
          }
        });
        const bookedCount = activeBookings.length;

        const avail = await tx.hotelAvailability.findUnique({
          where: { roomId_date: { roomId, date: d } }
        });

        if (avail && !avail.isActive) {
          throw new Error(`ROOM_UNAVAILABLE:${d.toISOString().split('T')[0]}`);
        }

        const totalCapacity = avail ? avail.totalRooms : (room.totalRooms || 1);
        if (!room.isAvailable || (bookedCount + 1) > totalCapacity) {
          throw new Error(`ROOM_FULL:${d.toISOString().split('T')[0]}`);
        }
      }

      // Upsert availability for each night
      for (const d of nights) {
        const avail = await tx.hotelAvailability.findUnique({
          where: { roomId_date: { roomId, date: d } }
        });

        const newBookedCount = (avail ? avail.bookedRooms : 0) + 1;
        const totalCap = avail ? avail.totalRooms : (room.totalRooms || 1);

        await tx.hotelAvailability.upsert({
          where: { roomId_date: { roomId, date: d } },
          update: { bookedRooms: newBookedCount },
          create: {
            roomId,
            date: d,
            totalRooms: totalCap,
            bookedRooms: 1,
            isActive: true
          }
        });
      }

      // Create booking record
      const created = await tx.booking.create({
        data: {
          userId: req.user!.id,
          providerId: hotelId,
          roomId,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: checkIn,
          returnDate: checkOut,
          numberOfPeople: numberOfGuests,
          totalAmount,
          discountAmount: 0,
          finalAmount: totalAmount,
          status: 'pending',
          paymentStatus: 'pending'
        },
        include: { provider: true, user: true, room: true }
      });

      return created;
    });

    return res.status(201).json({
      message: 'Hotel booking created successfully',
      booking,
      hotel: {
        id: hotel.id,
        businessName: hotel.businessName,
        address: hotel.address,
        phone: hotel.phone
      },
      customerInfo
    });
  } catch (error: any) {
    if (error.message?.startsWith('ROOM_FULL') || error.message?.startsWith('ROOM_UNAVAILABLE')) {
      return res.status(409).json({ error: 'Room not available for selected dates' });
    }
    return res.status(500).json({ error: error.message });
  }
});

// 7. Booking confirmation
router.get('/bookings/:bookingId/confirmation', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        user: true,
        room: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.category !== 'hotel') {
      return res.status(400).json({ error: 'This is not a hotel booking' });
    }

    return res.json({
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      hotel: {
        id: booking.provider.id,
        businessName: booking.provider.businessName,
        address: booking.provider.address,
        phone: booking.provider.phone
      },
      room: booking.room ? {
        id: booking.room.id,
        name: booking.room.name,
        type: booking.room.type,
        price: booking.room.price
      } : null,
      customer: {
        id: booking.user.id,
        fullName: booking.user.fullName,
        phone: booking.user.phone
      },
      checkInDate: booking.travelDate,
      checkOutDate: booking.returnDate,
      numberOfGuests: booking.numberOfPeople,
      totalAmount: booking.totalAmount,
      discountAmount: booking.discountAmount,
      finalAmount: booking.finalAmount,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 8. Booking status endpoint
router.get('/bookings/:bookingId/status', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        user: true
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
      returnDate: booking.returnDate,
      updatedAt: booking.updatedAt
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 9. Cancellation handling & Inventory release
router.patch('/bookings/:bookingId/cancel', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.category !== 'hotel') {
      return res.status(400).json({ error: 'This is not a hotel booking' });
    }

    if (!['pending', 'confirmed', 'paid'].includes(booking.status)) {
      return res.status(400).json({
        error: `Cannot cancel booking with status: ${booking.status}`
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date()
        },
        include: { provider: true, user: true }
      });

      if (b.roomId && b.travelDate && b.returnDate) {
        const nights = getDatesInRange(new Date(b.travelDate), new Date(b.returnDate));
        for (const d of nights) {
          const avail = await tx.hotelAvailability.findUnique({
            where: { roomId_date: { roomId: b.roomId, date: d } }
          });
          if (avail && avail.bookedRooms > 0) {
            await tx.hotelAvailability.update({
              where: { id: avail.id },
              data: { bookedRooms: avail.bookedRooms - 1 }
            });
          }
        }
      }

      return b;
    });

    return res.json({
      message: 'Hotel booking cancelled successfully',
      booking: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 10. Provider/vendor hotel management (full CRUD)
const hotelManagementSchema = z.object({
  businessName: z.string().min(2).max(200),
  address: z.string().min(1).max(500),
  city: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: z.string().optional(),
  description: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional()
});

// POST /api/v1/hotels (create hotel provider)
router.post('/', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const parse = hotelManagementSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { businessName, address, city, latitude, longitude, phone, description, commissionRate } = parse.data;

    // Check if user already has a hotel provider
    const existingProvider = await prisma.serviceProvider.findFirst({
      where: { userId: req.user!.id, category: 'hotel' }
    });
    if (existingProvider) {
      return res.status(409).json({ error: 'User already has a hotel provider account' });
    }

    const provider = await prisma.serviceProvider.create({
      data: {
        userId: req.user!.id,
        businessName,
        category: 'hotel',
        address,
        city,
        latitude: latitude || null,
        longitude: longitude || null,
        phone,
        description,
        commissionRate: req.user!.role === 'admin' && commissionRate ? commissionRate : 10.00,
        status: 'PENDING',
        isVerified: false,
        isActive: false
      }
    });

    return res.status(201).json({
      message: 'Hotel provider created successfully. Awaiting admin verification.',
      provider
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/hotels/:id (update hotel provider)
router.patch('/:id', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotelId = parseInt(req.params.id);
    if (!Number.isFinite(hotelId) || hotelId <= 0) {
      return res.status(400).json({ error: 'Invalid hotel id' });
    }

    const parse = hotelManagementSchema.partial().safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    // Check ownership
    const provider = await prisma.serviceProvider.findUnique({
      where: { id: hotelId }
    });
    if (!provider || provider.category !== 'hotel') {
      return res.status(404).json({ error: 'Hotel provider not found' });
    }

    if (provider.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const data: Record<string, any> = { ...parse.data };
    if (data.latitude === undefined) delete data.latitude;
    if (data.longitude === undefined) delete data.longitude;
    if (data.phone === undefined) delete data.phone;

    const updated = await prisma.serviceProvider.update({
      where: { id: hotelId },
      data
    });

    return res.json({
      message: 'Hotel provider updated successfully',
      provider: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/hotels/:id/verify (admin verifies hotel)
router.patch('/:id/verify', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const hotelId = parseInt(req.params.id);
    if (!Number.isFinite(hotelId) || hotelId <= 0) {
      return res.status(400).json({ error: 'Invalid hotel id' });
    }
    const provider = await prisma.serviceProvider.findUnique({ where: { id: hotelId } });
    if (!provider || provider.category !== 'hotel') {
      return res.status(404).json({ error: 'Hotel provider not found' });
    }
    const updated = await prisma.serviceProvider.update({
      where: { id: hotelId },
      data: { isVerified: true, status: 'APPROVED', isActive: true, verifiedAt: new Date() }
    });
    return res.json({ message: 'Hotel verified successfully', hotel: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// HOTEL DASHBOARD (vendor only)
// =====================================================================

// GET /api/v1/hotels/dashboard/summary
router.get('/dashboard/summary', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await prisma.serviceProvider.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      select: { id: true }
    });
    const hotelIds = vendorProviderIds.map(p => p.id);

    if (hotelIds.length === 0) {
      return res.json({
        hotels: [],
        rooms: { total: 0, available: 0 },
        bookings: { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
        todayCheckIns: 0,
        todayCheckOuts: 0,
        revenue: { gross: 0, commission: 0, net: 0, currency: 'BDT' }
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const hotels = await prisma.serviceProvider.findMany({
      where: { id: { in: hotelIds } },
      include: {
        rooms: {
          include: {
            availabilities: {
              where: { date: { gte: today, lt: tomorrow } }
            }
          }
        }
      }
    });

    const rooms = await prisma.room.findMany({
      where: { providerId: { in: hotelIds } }
    });

    const bookings = await prisma.booking.findMany({
      where: { providerId: { in: hotelIds }, category: 'hotel' },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        finalAmount: true,
        travelDate: true,
        returnDate: true,
        completedAt: true
      }
    });

    const todayCheckIns = bookings.filter(b =>
      b.status === 'confirmed' &&
      b.travelDate >= today &&
      b.travelDate < tomorrow
    ).length;

    const todayCheckOuts = bookings.filter(b =>
      b.status === 'completed' &&
      b.completedAt &&
      b.completedAt >= today &&
      b.completedAt < tomorrow
    ).length;

    const paidBookings = bookings.filter(b => b.paymentStatus === 'paid');
    const grossRevenue = paidBookings.reduce((sum, b) => sum + b.finalAmount, 0);

    const provider = await prisma.serviceProvider.findFirst({
      where: { id: { in: hotelIds } }
    });
    const commissionRate = await resolveCommissionRate({ providerRate: provider?.commissionRate });
    const totalCommission = (grossRevenue * commissionRate) / 100;
    const hotelPayable = grossRevenue - totalCommission;

    return res.json({
      hotels: hotels.map(h => ({
        id: h.id,
        businessName: h.businessName,
        status: h.status,
        isVerified: h.isVerified
      })),
      rooms: {
        total: rooms.length,
        available: rooms.filter(r => r.isAvailable).length
      },
      bookings: {
        total: bookings.length,
        pending: bookings.filter(b => b.status === 'pending').length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        completed: bookings.filter(b => b.status === 'completed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length
      },
      todayCheckIns,
      todayCheckOuts,
      revenue: {
        gross: grossRevenue,
        commissionRate,
        commission: totalCommission,
        net: hotelPayable,
        currency: 'BDT'
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/hotels/dashboard/check-ins-today
router.get('/dashboard/check-ins-today', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await prisma.serviceProvider.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      select: { id: true }
    });
    const hotelIds = vendorProviderIds.map(p => p.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: { in: hotelIds },
        category: 'hotel',
        travelDate: { gte: today, lt: tomorrow }
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        room: true
      },
      orderBy: { travelDate: 'asc' }
    });

    return res.json({
      date: today.toISOString().split('T')[0],
      count: bookings.length,
      checkIns: bookings.map(b => ({
        bookingId: b.id,
        bookingCode: b.bookingCode,
        guestName: b.user.fullName || b.user.phone,
        roomName: b.room?.name || 'N/A',
        status: b.status,
        paymentStatus: b.paymentStatus
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/hotels/dashboard/check-outs-today
router.get('/dashboard/check-outs-today', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await prisma.serviceProvider.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      select: { id: true }
    });
    const hotelIds = vendorProviderIds.map(p => p.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: { in: hotelIds },
        category: 'hotel',
        status: 'confirmed',
        returnDate: { gte: today, lt: tomorrow }
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        room: true
      },
      orderBy: { returnDate: 'asc' }
    });

    return res.json({
      date: today.toISOString().split('T')[0],
      count: bookings.length,
      checkOuts: bookings.map(b => ({
        bookingId: b.id,
        bookingCode: b.bookingCode,
        guestName: b.user.fullName || b.user.phone,
        roomName: b.room?.name || 'N/A',
        status: b.status
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/hotels/dashboard/settlements
router.get('/dashboard/settlements', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const vendorProviderIds = await prisma.serviceProvider.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      select: { id: true }
    });
    const hotelIds = vendorProviderIds.map(p => p.id);

    const settlements = await prisma.settlement.findMany({
      where: { providerId: { in: hotelIds } },
      include: { booking: { select: { bookingCode: true, category: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const totalGross = settlements.reduce((sum, s) => sum + s.grossAmount, 0);
    const totalCommission = settlements.reduce((sum, s) => sum + s.commissionAmount, 0);
    const totalNet = settlements.reduce((sum, s) => sum + s.netAmount, 0);

    return res.json({
      summary: {
        totalGross,
        totalCommission,
        totalNet,
        currency: 'BDT',
        count: settlements.length
      },
      settlements: settlements.map(s => ({
        id: s.id,
        bookingCode: s.booking?.bookingCode,
        grossAmount: s.grossAmount,
        commissionRate: s.commissionRate,
        commissionAmount: s.commissionAmount,
        netAmount: s.netAmount,
        status: s.status,
        settledAt: s.settledAt,
        createdAt: s.createdAt
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/hotels/dashboard/settlements (admin creates settlement for completed booking)
router.post('/dashboard/settlements', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: { provider: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.category !== 'hotel') {
      return res.status(400).json({ error: 'Booking is not a hotel booking' });
    }

    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'Booking payment not confirmed' });
    }

    // Check if settlement already exists
    const existing = await prisma.settlement.findFirst({
      where: { bookingId: booking.id }
    });
    if (existing) {
      return res.status(409).json({ error: 'Settlement already exists for this booking' });
    }

    const commissionRate = await resolveCommissionRate({ providerRate: booking.provider.commissionRate });
    const commissionAmount = (booking.finalAmount * commissionRate) / 100;
    const netAmount = booking.finalAmount - commissionAmount;

    const settlement = await prisma.settlement.create({
      data: {
        providerId: booking.providerId,
        bookingId: booking.id,
        grossAmount: booking.finalAmount,
        commissionRate,
        commissionAmount,
        netAmount,
        status: 'pending'
      }
    });

    return res.status(201).json({
      message: 'Settlement created successfully',
      settlement
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/hotels/dashboard/settlements/:id/mark-paid (admin marks settlement as paid)
router.patch('/dashboard/settlements/:id/mark-paid', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const settlementId = parseInt(req.params.id);
    if (!Number.isFinite(settlementId) || settlementId <= 0) {
      return res.status(400).json({ error: 'Invalid settlement id' });
    }

    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId }
    });

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    if (settlement.status === 'paid') {
      return res.status(400).json({ error: 'Settlement already marked as paid' });
    }

    const updated = await prisma.settlement.update({
      where: { id: settlementId },
      data: { status: 'paid', settledAt: new Date() }
    });

    return res.json({
      message: 'Settlement marked as paid',
      settlement: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;