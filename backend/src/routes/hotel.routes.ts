import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { resolveCommissionRate } from '../utils/commission';
import { z } from 'zod';
import { verifyHmacSignature, generateHmacSignature, generateTravelPassToken } from '../utils/qr';
import { round2 } from '../utils/pricing';
import { notifyUser } from '../utils/notifications';
import { createHotelBooking } from './hotel-booking.routes';
import { canTransitionHotelBooking } from '../utils/hotel-booking-state';
import { safeError } from '../utils/safeError';

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
  checkOut: z.string().optional(),
  guests: z.coerce.number().int().positive().optional(),
  amenities: z.string().optional(), // comma-separated names
  starRating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating_desc', 'newest']).optional().default('relevance'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(12)
});

// 1. Hotel listing/search (public)
router.get('/search', async (req, res) => {
  try {
    const parse = hotelSearchSchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }
    const { city, providerId, rating, minPrice, maxPrice, sort, page, limit, amenities, starRating, guests } = parse.data;

    const where: any = { category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED', isPublished: true, lifecycleStatus: 'APPROVED' };
    if (city) where.city = city;
    if (providerId) where.id = providerId;
    if (starRating) where.starRating = { gte: starRating };

    if (amenities) {
      const names = amenities.split(',').map(s => s.trim()).filter(Boolean);
      if (names.length > 0) {
        // AND semantics: hotel must have ALL requested amenities
        where.AND = names.map(name => ({
          hotelAmenities: { some: { name } }
        }));
      }
    }

    const orderBy: any =
      sort === 'price_asc' || sort === 'price_desc' ? { createdAt: 'desc' } :
      sort === 'rating_desc' ? { rating: 'desc' } :
      sort === 'newest' ? { createdAt: 'desc' } :
      { createdAt: 'desc' };

    const skip = (page - 1) * limit;

    const [total, hotels] = await Promise.all([
      prisma.serviceProvider.count({ where }),
      prisma.serviceProvider.findMany({
        where,
        include: {
          rooms: { include: { ratePlans: { where: { isActive: true } } } },
          hotelImages: { where: { isPrimary: true } },
          hotelAmenities: true
        },
        orderBy,
        skip,
        take: limit
      })
    ]);

    const filteredHotels = hotels.map(hotel => {
      const rooms = hotel.rooms || [];
      const prices = rooms.map(room => room.price);
      const minRoomPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxRoomPrice = prices.length > 0 ? Math.max(...prices) : 0;

      if (minPrice && minRoomPrice < minPrice) return null;
      if (maxPrice && maxRoomPrice > maxPrice) return null;
      if (rating && hotel.rating && hotel.rating < rating) return null;
      if (guests && !rooms.some(r => (r.adultCapacity ?? r.capacity) >= guests)) return null;

      return {
        id: hotel.id,
        slug: hotel.slug,
        businessName: hotel.businessName,
        category: hotel.category,
        description: hotel.description,
        address: hotel.address,
        city: hotel.city,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        starRating: hotel.starRating,
        isVerified: hotel.isVerified,
        rating: hotel.rating,
        totalReviews: hotel.totalReviews,
        phone: hotel.phone,
        primaryImage: hotel.hotelImages?.[0]?.url || null,
        amenities: hotel.hotelAmenities.map(a => a.name),
        startingPrice: minRoomPrice,
        rooms: rooms.map(room => ({
          id: room.id,
          name: room.name,
          type: room.type,
          description: room.description,
          price: room.price,
          capacity: room.capacity,
          adultCapacity: room.adultCapacity,
          childCapacity: room.childCapacity,
          totalRooms: room.totalRooms,
          amenities: room.amenities,
          images: room.images,
          isAvailable: room.isAvailable,
          ratePlans: room.ratePlans.map(p => ({ id: p.id, name: p.name, price: p.price, mealPlan: p.mealPlan, refundable: p.refundable }))
        }))
      };
    }).filter(hotel => hotel !== null);

    let sorted = filteredHotels;
    if (sort === 'price_asc') sorted = [...filteredHotels].sort((a, b) => a.startingPrice - b.startingPrice);
    if (sort === 'price_desc') sorted = [...filteredHotels].sort((a, b) => b.startingPrice - a.startingPrice);

    return res.json({
      count: sorted.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hotels: sorted
    });
  } catch (error: any) {
    return res.status(500).json({ error: safeError(error) });
  }
});

// 1b. List available cities (public)
router.get('/cities', async (_req, res) => {
  try {
    const cities = await prisma.serviceProvider.findMany({
      where: { category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED', isPublished: true, lifecycleStatus: 'APPROVED' },
      select: { city: true },
      distinct: ['city']
    });
    const list = cities.map(c => c.city).filter(Boolean).sort();
    return res.json({ count: list.length, cities: list });
  } catch (error: any) {
    return res.status(500).json({ error: safeError(error) });
  }
});

// 1c. Top destinations / featured hotels (public)
router.get('/discover', async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '6'))));
    const featured = await prisma.serviceProvider.findMany({
      where: {
        category: 'hotel',
        isVerified: true,
        isActive: true,
        status: 'APPROVED',
        isPublished: true,
        rating: { gte: 3 }
      },
      include: {
        rooms: { select: { price: true } },
        hotelImages: { where: { isPrimary: true }, select: { url: true } },
        hotelAmenities: { select: { name: true } }
      },
      orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
      take: limit
    });

    const data = featured.map(h => ({
      id: h.id,
      slug: h.slug,
      businessName: h.businessName,
      city: h.city,
      starRating: h.starRating,
      rating: h.rating,
      totalReviews: h.totalReviews,
      primaryImage: h.hotelImages?.[0]?.url || null,
      amenities: h.hotelAmenities.map(a => a.name),
      startingPrice: h.rooms.length > 0 ? Math.min(...h.rooms.map(r => r.price)) : 0
    }));

    return res.json({ count: data.length, hotels: data });
  } catch (error: any) {
    return res.status(500).json({ error: safeError(error) });
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
      where: { id: hotelId, category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED', lifecycleStatus: 'APPROVED' },
      include: {
        rooms: {
          include: {
            availabilities: true,
            ratePlans: { where: { isActive: true } }
          }
        },
        hotelImages: { orderBy: { sortOrder: 'asc' } },
        hotelAmenities: true,
        hotelPolicy: true
      }
    });

    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    const reviews = await prisma.review.findMany({
      where: { booking: { providerId: hotel.id, category: 'hotel' } },
      include: { user: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return res.json({
      id: hotel.id,
      slug: hotel.slug,
      businessName: hotel.businessName,
      category: hotel.category,
      description: hotel.description,
      address: hotel.address,
      city: hotel.city,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
      isVerified: hotel.isVerified,
      starRating: hotel.starRating,
      rating: hotel.rating,
      totalReviews: hotel.totalReviews,
      phone: hotel.phone,
      images: hotel.hotelImages.map(i => ({ url: i.url, caption: i.caption, isPrimary: i.isPrimary })),
      amenities: hotel.hotelAmenities.map(a => a.name),
      policy: hotel.hotelPolicy,
      rooms: hotel.rooms.map(room => ({
        id: room.id,
        name: room.name,
        type: room.type,
        description: room.description,
        price: room.price,
        currency: room.baseCurrency,
        capacity: room.capacity,
        adultCapacity: room.adultCapacity,
        childCapacity: room.childCapacity,
        bedConfig: room.bedConfig,
        totalRooms: room.totalRooms,
        amenities: room.amenities,
        images: room.images,
        isAvailable: room.isAvailable,
        ratePlans: room.ratePlans.map(p => ({ id: p.id, name: p.name, price: p.price, mealPlan: p.mealPlan, refundable: p.refundable, minStay: p.minStay, maxStay: p.maxStay })),
        availabilities: room.availabilities.map(avail => ({
          date: avail.date.toISOString().split('T')[0],
          totalRooms: avail.totalRooms,
          bookedRooms: avail.bookedRooms,
          isActive: avail.isActive
        }))
      })),
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewer: r.user.fullName || 'Anonymous',
        createdAt: r.createdAt
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: safeError(error) });
  }
});

// Provider: list my hotels
router.get('/my', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const hotels = await prisma.serviceProvider.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      select: {
        id: true,
        businessName: true,
        slug: true,
        status: true,
        lifecycleStatus: true,
        isVerified: true,
        isActive: true,
        isPublished: true,
        city: true,
        address: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { rooms: true, hotelAmenities: true, bookings: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ count: hotels.length, hotels });
  } catch (error: any) {
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
  }
});

// List rooms for a hotel (public)
router.get('/rooms', async (req, res) => {
  try {
    const hotelId = req.query.hotelId ? parseInt(req.query.hotelId as string) : null;
    if (!hotelId) return res.status(400).json({ error: 'hotelId required' });

    const hotel = await prisma.serviceProvider.findFirst({
      where: { id: hotelId, category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED', lifecycleStatus: 'APPROVED', isPublished: true }
    });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found or not available for booking' });

    const where: any = { providerId: hotelId };
    const rooms = await prisma.room.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json({ count: rooms.length, rooms });
  } catch (error: any) {
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
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
        include: { provider: true, user: true, room: true }
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

      if (booking.status === 'completed') {
        return res.status(400).json({ error: 'Booking already checked out' });
      }

      if (booking.checkedInAt) {
        return res.status(400).json({ error: 'Booking already checked in' });
      }

      if (booking.paymentStatus !== 'paid') {
        return res.status(400).json({ error: 'Cannot check in: payment not confirmed' });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkOutDate = booking.returnDate ? new Date(booking.returnDate) : null;
      if (checkOutDate) {
        checkOutDate.setHours(0, 0, 0, 0);
        if (today > checkOutDate) {
          return res.status(400).json({ error: 'Booking stay period has ended' });
        }
      }

      const validUntilDate = new Date(booking.travelDate);
      validUntilDate.setDate(validUntilDate.getDate() + 5);
      if (today > validUntilDate) {
        return res.status(400).json({ error: 'Travel pass expired' });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const alreadyScanned = await prisma.qrLog.findFirst({
        where: {
          bookingId: booking.id,
          scannedAt: { gte: todayStart }
        }
      });
      if (alreadyScanned) {
        return res.status(409).json({
          error: 'Travel pass already verified today (replay protection)',
          firstScannedAt: alreadyScanned.scannedAt
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'confirmed', checkedInAt: new Date() }
        });

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

        if (booking.roomId && booking.room && booking.room.totalRooms === 1) {
          await tx.room.update({
            where: { id: booking.roomId },
            data: { status: 'OCCUPIED' }
          });
        }

        return { updated, qrLog };
      });

      return res.json({
        message: `Check-in successful for booking #${booking.bookingCode}`,
        booking: result.updated,
        checkedInAt: result.qrLog.scannedAt,
        guestName: booking.user.fullName || booking.user.phone
      });
    } catch (error: any) {
      return res.status(500).json({ error: safeError(error) });
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
        include: { provider: true, room: true }
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

      if (!booking.checkedInAt) {
        return res.status(400).json({ error: 'Guest must be checked in before check-out' });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const completed = await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'completed', completedAt: new Date() }
        });

        if (booking.roomId && booking.room && booking.room.totalRooms === 1) {
          await tx.room.update({
            where: { id: booking.roomId },
            data: { status: 'CLEANING' }
          });
        }

        await tx.housekeepingTask.create({
          data: {
            providerId: booking.providerId,
            roomId: booking.roomId!,
            status: 'PENDING',
            notes: `Auto-created after check-out for booking #${booking.bookingCode}`
          }
        });

        return completed;
      });

      return res.json({
        message: `Check-out successful for booking #${booking.bookingCode}`,
        booking: updated
      });
    } catch (error: any) {
      return res.status(500).json({ error: safeError(error) });
    }
  });

router.post('/book', authenticateJWT, async (req: AuthRequest, res) => {
  const originalBody = req.body;
  req.body = {
    ...originalBody,
    checkIn: originalBody.checkInDate,
    checkOut: originalBody.checkOutDate,
    numberOfRooms: originalBody.numberOfRooms || 1,
    source: 'ETP'
  };
  return createHotelBooking(req, res);
});

// Customer-facing: list my hotel bookings
router.get('/my-bookings', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      include: {
        provider: { select: { id: true, businessName: true, address: true, city: true, slug: true, starRating: true } },
        room: { select: { id: true, name: true, type: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ count: bookings.length, bookings });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Provider: list bookings for my hotels
router.get('/provider-bookings', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const providerIds = await prisma.serviceProvider.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      select: { id: true }
    });
    const hotelIds = providerIds.map(p => p.id);
    if (hotelIds.length === 0) return res.json({ count: 0, bookings: [] });

    const status = req.query.status ? String(req.query.status) : null;
    const bookings = await prisma.booking.findMany({
      where: {
        providerId: { in: hotelIds },
        category: 'hotel',
        ...(status ? { status } : {})
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        room: { select: { id: true, name: true, type: true, price: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ count: bookings.length, bookings });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
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

    const isOwner = booking.userId === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const isVendor = booking.provider?.userId === req.user!.id;
    if (!isOwner && !isAdmin && !isVendor) {
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
    return res.status(500).json({ error: safeError(error) });
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

    const isOwner = booking.userId === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const isVendor = booking.provider?.userId === req.user!.id;
    if (!isOwner && !isAdmin && !isVendor) {
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
    return res.status(500).json({ error: safeError(error) });
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

    const isOwner = booking.userId === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const isVendor = booking.provider?.userId === req.user!.id;
    if (!isOwner && !isAdmin && !isVendor) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.category !== 'hotel') {
      return res.status(400).json({ error: 'This is not a hotel booking' });
    }

    if (!canTransitionHotelBooking(booking.status, 'cancelled')) {
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
              data: { bookedRooms: Math.max(0, avail.bookedRooms - (b.numberOfRooms || 1)) }
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
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
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
      select: { id: true, businessName: true, status: true, isVerified: true, commissionRate: true }
    });

    const rooms = await prisma.room.findMany({
      where: { providerId: { in: hotelIds } },
      select: { isAvailable: true }
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

    const commissionRate = await resolveCommissionRate({ providerRate: hotels[0]?.commissionRate });
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
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
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
    return res.status(500).json({ error: safeError(error) });
  }
});

// Hotel review (customer must have completed hotel stay; bookingId is unique on Review)
router.post('/:hotelId/reviews', authenticateJWT, requireRole(['customer']), async (req: AuthRequest, res) => {
  try {
    const hotelId = Number(req.params.hotelId);
    const { bookingId, rating, comment } = req.body || {};
    if (!Number.isFinite(hotelId) || !Number.isFinite(bookingId) || !Number.isFinite(rating)) {
      return res.status(400).json({ error: 'hotelId, bookingId, rating required' });
    }
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user!.id) return res.status(403).json({ error: 'Not your booking' });
    if (booking.category !== 'hotel' || booking.providerId !== hotelId) return res.status(400).json({ error: 'Booking does not match hotel' });
    if (booking.status !== 'completed' && booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Can only review completed or confirmed stays' });
    }

    const existing = await prisma.review.findUnique({ where: { bookingId } });
    if (existing) return res.status(409).json({ error: 'Review already exists for this booking' });

    const review = await prisma.review.create({
      data: { bookingId, userId: req.user!.id, rating, comment: comment?.trim() || null }
    });

    await recomputeHotelRating(hotelId);

    return res.status(201).json({ message: 'Review submitted', review });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

async function recomputeHotelRating(hotelId: number) {
  const result = await prisma.review.aggregate({
    where: { booking: { providerId: hotelId, category: 'hotel' } },
    _avg: { rating: true },
    _count: { rating: true }
  });
  await prisma.serviceProvider.update({
    where: { id: hotelId },
    data: {
      rating: result._avg.rating ?? 0,
      totalReviews: result._count.rating ?? 0
    }
  });
}

// Hotel reports for vendors (and admin); aggregates by date range and optionally per-hotel
router.get('/reports/summary', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { from, to, hotelId } = req.query as { from?: string; to?: string; hotelId?: string };
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const toDate = to ? new Date(to) : new Date();
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    const providerFilter: any = { category: 'hotel' };
    if (req.user!.role === 'vendor') {
      providerFilter.userId = req.user!.id;
    }
    if (hotelId) {
      const hid = Number(hotelId);
      if (!Number.isFinite(hid)) return res.status(400).json({ error: 'Invalid hotelId' });
      providerFilter.id = hid;
    }

    const providers = await prisma.serviceProvider.findMany({ where: providerFilter, select: { id: true, businessName: true } });
    const providerIds = providers.map(p => p.id);
    if (providerIds.length === 0) {
      return res.json({ range: { from: fromDate, to: toDate }, byHotel: [], totals: { bookings: 0, gross: 0, commission: 0, net: 0 } });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        category: 'hotel',
        providerId: { in: providerIds },
        createdAt: { gte: fromDate, lte: toDate }
      },
      select: { providerId: true, status: true, paymentStatus: true, finalAmount: true, source: true }
    });

    const byHotelMap = new Map<number, { id: number; businessName: string; bookings: number; paid: number; cancelled: number; gross: number; commission: number; net: number }>();
    for (const p of providers) byHotelMap.set(p.id, { id: p.id, businessName: p.businessName, bookings: 0, paid: 0, cancelled: 0, gross: 0, commission: 0, net: 0 });

    const totals = { bookings: 0, gross: 0, commission: 0, net: 0 };
    for (const b of bookings) {
      const row = byHotelMap.get(b.providerId);
      if (!row) continue;
      row.bookings += 1;
      if (b.status === 'cancelled') {
        row.cancelled += 1;
        continue;
      }
      if (b.paymentStatus !== 'paid') continue;
      row.paid += 1;
      const gross = Number(b.finalAmount) || 0;
      const rate = b.source === 'DIRECT' ? 0 : 0.10;
      const commission = gross * rate;
      const net = gross - commission;
      row.gross = round2(row.gross + gross);
      row.commission = round2(row.commission + commission);
      row.net = round2(row.net + net);
      totals.gross = round2(totals.gross + gross);
      totals.commission = round2(totals.commission + commission);
      totals.net = round2(totals.net + net);
    }
    totals.bookings = bookings.length;

    return res.json({ range: { from: fromDate, to: toDate }, byHotel: Array.from(byHotelMap.values()), totals });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

export default router;