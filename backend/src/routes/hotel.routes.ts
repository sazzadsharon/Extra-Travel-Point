import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Input validation for hotel search/filter
const hotelSearchSchema = z.object({
  city: z.string().optional(),
  providerId: z.coerce.number().int().positive().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
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
        rooms: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Apply price filter based on rooms
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

    const { hotelId, name, type, description, price, capacity, amenities, images, isAvailable } = parse.data;

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
      where.date = { gte: new Date(String(from)), lte: new Date(String(to)) };
    }
    const availabilities = await prisma.hotelAvailability.findMany({ where, orderBy: { date: 'asc' } });
    return res.json({ count: availabilities.length, availabilities });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. Check-in & Check-out handling (vendor only)
router.post('/check-in', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
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

    if (booking.provider.category !== 'hotel') {
      return res.status(400).json({ error: 'Booking is not a hotel booking' });
    }

    if (booking.provider.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'confirmed' }
    });

    return res.json({
      message: `Check-in successful for booking #${booking.bookingCode}`,
      booking: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/check-out', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
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

    if (booking.provider.category !== 'hotel') {
      return res.status(400).json({ error: 'Booking is not a hotel booking' });
    }

    if (booking.provider.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
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

// 6. Hotel booking (customer)
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
    const checkOut = new Date(checkOutDate);
    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date' });
    }

    // Check room availability for the dates
    const bookedRooms = await prisma.hotelAvailability.findMany({
      where: {
        roomId,
        date: { gte: checkIn, lt: checkOut },
        bookedRooms: { gt: 0 }
      }
    });

    if (bookedRooms.length > 0) {
      return res.status(409).json({ error: 'Room not available for selected dates' });
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId: req.user!.id,
        providerId: hotelId,
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
      include: { provider: true, user: true }
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
        user: true
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

// 9. Basic cancellation handling
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

    // Only allow cancellation if booking is pending or confirmed
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        error: `Cannot cancel booking with status: ${booking.status}`
      });
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date()
      },
      include: { provider: true, user: true }
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

export default router;
