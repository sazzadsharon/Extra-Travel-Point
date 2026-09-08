import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { calculatePrice, datesInRange, nightsBetween } from '../utils/pricing';
import { notifyUser } from '../utils/notifications';
import { canTransitionHotelBooking } from '../utils/hotel-booking-state';
import { expireHotelBookingIfNeeded } from '../utils/hotel-booking-expiry';
import { safeError } from '../utils/safeError';

const router = Router();

const bookingSchema = z.object({
  hotelId: z.number().int().positive(),
  roomId: z.number().int().positive(),
  checkIn: z.string().refine(v => !isNaN(Date.parse(v))),
  checkOut: z.string().refine(v => !isNaN(Date.parse(v))),
  numberOfGuests: z.number().int().positive(),
  numberOfRooms: z.number().int().positive().optional().default(1),
  promoCode: z.string().optional(),
  ratePlanId: z.number().int().positive().optional(),
  source: z.enum(['ETP', 'DIRECT', 'PHONE', 'WALK_IN', 'MANUAL']).optional().default('ETP'),
  customerInfo: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(10)
  }).optional()
});

export async function createHotelBooking(req: AuthRequest, res: any) {
  try {
    const parse = bookingSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues });

    const { hotelId, roomId, checkIn, checkOut, numberOfGuests, numberOfRooms, promoCode, ratePlanId, source, customerInfo } = parse.data;

    const hotel = await prisma.serviceProvider.findFirst({
      where: { id: hotelId, category: 'hotel', isVerified: true, isActive: true, status: 'APPROVED', lifecycleStatus: 'APPROVED' }
    });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found or not approved' });

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.providerId !== hotelId) return res.status(404).json({ error: 'Room not found' });

    const inDate = new Date(checkIn); inDate.setHours(0, 0, 0, 0);
    const outDate = new Date(checkOut); outDate.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (inDate < today) return res.status(400).json({ error: 'Check-in date cannot be in the past' });
    if (outDate <= inDate) return res.status(400).json({ error: 'Check-out must be after check-in' });

    const nights = nightsBetween(inDate, outDate);
    if (nights > 365) return res.status(400).json({ error: 'Stay duration cannot exceed 365 nights' });

    if (numberOfGuests > room.adultCapacity + room.childCapacity) {
      return res.status(400).json({ error: `Exceeds room capacity` });
    }
    if (numberOfRooms > room.totalRooms) {
      return res.status(400).json({ error: `Requested rooms (${numberOfRooms}) exceeds total rooms (${room.totalRooms})` });
    }
    if (room.status !== 'ACTIVE' || !room.isAvailable) {
      return res.status(400).json({ error: 'Room is not available for booking' });
    }

    // Rate plan validation & pricing integrity
    let ratePlan = null as null | { id: number; name: string; price: number; currency: string; mealPlan: string; refundable: boolean; minStay: number; maxStay: number | null };
    if (ratePlanId != null) {
      const rp = await prisma.ratePlan.findUnique({ where: { id: ratePlanId } });
      if (!rp || rp.roomId !== roomId) {
        return res.status(404).json({ error: 'Rate plan not found for this room' });
      }
      if (!rp.isActive) {
        return res.status(400).json({ error: 'Selected rate plan is inactive' });
      }
      if (rp.startDate && inDate < rp.startDate) {
        return res.status(400).json({ error: 'Booking check-in date is before rate plan start date' });
      }
      if (rp.endDate && outDate > rp.endDate) {
        return res.status(400).json({ error: 'Booking check-out date is after rate plan end date' });
      }
      if (rp.minStay && nights < rp.minStay) {
        return res.status(400).json({ error: `Rate plan requires a minimum stay of ${rp.minStay} night(s)` });
      }
      if (rp.maxStay && nights > rp.maxStay) {
        return res.status(400).json({ error: `Rate plan allows a maximum stay of ${rp.maxStay} night(s)` });
      }
      ratePlan = {
        id: rp.id,
        name: rp.name,
        price: rp.price,
        currency: rp.currency,
        mealPlan: rp.mealPlan,
        refundable: rp.refundable,
        minStay: rp.minStay,
        maxStay: rp.maxStay
      };
    }

    const effectivePrice = ratePlan ? ratePlan.price : room.price;
    const effectiveCurrency = ratePlan ? ratePlan.currency : room.baseCurrency;

    const dates = datesInRange(inDate, outDate);

    // Resolve promotion
    let promotion = null as null | { id: number; code: string; discountType: 'percentage' | 'fixed'; discountValue: number; minNights: number; minAmount: number };
    if (promoCode) {
      const now = new Date();
      const p = await prisma.hotelPromotion.findFirst({
        where: {
          providerId: hotelId,
          code: promoCode.toUpperCase(),
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now }
        }
      });
      if (p) {
        const exceedsUsage = p.usageLimit != null && p.usedCount >= p.usageLimit;
        if (!exceedsUsage) {
          promotion = {
            id: p.id,
            code: p.code,
            discountType: p.discountType === 'percentage' ? 'percentage' : 'fixed',
            discountValue: p.discountValue,
            minNights: p.minNights,
            minAmount: p.minAmount
          };
        }
      }
    }

    // Transactional booking creation with double-booking prevention
    const booking = await prisma.$transaction(async (tx) => {
      const currentRoom = await tx.room.findUnique({ where: { id: roomId } });
      if (!currentRoom || currentRoom.status !== 'ACTIVE' || !currentRoom.isAvailable) {
        throw { code: 'ROOM_UNAVAILABLE', date: inDate };
      }

      for (const d of dates) {
        await tx.hotelAvailability.upsert({
          where: { roomId_date: { roomId, date: d } },
          update: {},
          create: { roomId, date: d, totalRooms: currentRoom.totalRooms, bookedRooms: 0, isActive: true }
        });
        const availability = await tx.hotelAvailability.findUnique({
          where: { roomId_date: { roomId, date: d } }
        });
        if (!availability?.isActive) throw { code: 'ROOM_UNAVAILABLE', date: d };
        const reserved = await tx.hotelAvailability.updateMany({
          where: {
            id: availability.id,
            bookedRooms: { lte: availability.totalRooms - numberOfRooms }
          },
          data: { bookedRooms: { increment: numberOfRooms } }
        });
        if (reserved.count !== 1) throw { code: 'ROOM_FULL', date: d };
      }

      // Calculate price snapshot server-side (authoritative, never trust client total)
      const taxes = await prisma.hotelTax.findMany({
        where: { providerId: hotelId, isActive: true }
      });
      const taxRate = taxes.filter(t => t.type === 'percentage').reduce((s, t) => s + (Number.isFinite(t.value) ? t.value : 0), 0);
      const taxFlat = taxes.filter(t => t.type === 'fixed').reduce((s, t) => s + (Number.isFinite(t.value) ? t.value : 0), 0);

      const breakdown = calculatePrice({
        basePrice: effectivePrice,
        nights,
        currency: effectiveCurrency,
        promotion: promotion ? { discountType: promotion.discountType, discountValue: promotion.discountValue, minNights: promotion.minNights, minAmount: promotion.minAmount } : null,
        taxRate,
        serviceFeeFlat: taxFlat
      });

      // Per-room total multiplied by numberOfRooms
      const baseAmount = Math.round(breakdown.baseAmount * numberOfRooms * 100) / 100;
      const taxAmount = Math.round(breakdown.taxAmount * numberOfRooms * 100) / 100;
      const serviceFee = Math.round(breakdown.serviceFee * numberOfRooms * 100) / 100;
      const discountAmount = Math.round(breakdown.discountAmount * numberOfRooms * 100) / 100;
      const finalAmount = Math.max(0, Math.round((baseAmount + taxAmount + serviceFee - discountAmount) * 100) / 100);

      const priceSnapshot = JSON.stringify({
        roomId,
        ratePlanId: ratePlan?.id ?? null,
        ratePlanName: ratePlan?.name ?? null,
        ratePlanPrice: ratePlan?.price ?? null,
        roomPrice: room.price,
        nightlyRate: effectivePrice,
        nights,
        numberOfRooms,
        baseAmount,
        taxAmount,
        serviceFee,
        discountAmount,
        promotionId: promotion?.id ?? null,
        promotionCode: promotion?.code ?? null,
        finalAmount,
        currency: effectiveCurrency,
        source,
        snapshottedAt: new Date().toISOString()
      });

      const expiresAt = source === 'ETP' ? new Date(Date.now() + 15 * 60 * 1000) : null;

      const created = await tx.booking.create({
        data: {
          userId: req.user!.id,
          providerId: hotelId,
          roomId,
          ratePlanId: ratePlan?.id ?? null,
          category: 'hotel',
          bookingDate: new Date(),
          travelDate: inDate,
          returnDate: outDate,
          numberOfPeople: numberOfGuests,
          numberOfRooms,
          totalAmount: baseAmount + taxAmount + serviceFee,
          discountAmount,
          finalAmount,
          status: 'pending',
          paymentStatus: 'pending',
          source,
          priceSnapshot,
          promotionId: promotion?.id ?? null,
          promotionCode: promotion?.code ?? null,
          passengerInfo: customerInfo ? JSON.stringify(customerInfo) : null,
          expiresAt,
          qrToken: undefined
        } as any
      });

      if (promotion) {
        await tx.auditLog.create({
          data: {
            action: 'PROMOTION_RESERVED',
            actorId: req.user!.id,
            actorRole: req.user!.role,
            details: `Promotion ${promotion.code} reserved for booking ${created.bookingCode}`,
            metadata: JSON.stringify({ bookingId: created.id, promotionId: promotion.id })
          }
        });
      }
      await tx.auditLog.create({
        data: {
          action: 'HOTEL_BOOKING_CREATED',
          actorId: req.user!.id,
          actorRole: req.user!.role,
          details: `Hotel booking ${created.bookingCode} created`,
          metadata: JSON.stringify({ bookingId: created.id, providerId: hotelId, roomId })
        }
      });

      return { booking: created, breakdown, expiresAt };
    });

    const hotelRecord = await prisma.serviceProvider.findUnique({ where: { id: hotelId }, select: { businessName: true, userId: true } });
    const createdCode = booking.booking.bookingCode;
    const createdAmount = booking.booking.finalAmount;
    const numRooms = numberOfRooms;
    const bookingUserId = req.user!.id;

    void notifyUser(bookingUserId, 'HOTEL_BOOKING_CREATED', 'Hotel booking pending', `Your booking ${createdCode} at ${hotelRecord?.businessName ?? 'the hotel'} is pending payment.`);
    if (hotelRecord) {
      void notifyUser(hotelRecord.userId, 'HOTEL_BOOKING_NEW_VENDOR', 'New hotel booking', `Customer booked ${numRooms} room(s) at ${hotelRecord.businessName}. Code: ${createdCode}`);
    }

    return res.status(201).json({
      message: 'Hotel booking created',
      booking: booking.booking,
      breakdown: booking.breakdown,
      expiresAt: booking.expiresAt
    });
  } catch (err: any) {
    if (err?.code === 'ROOM_FULL') {
      return res.status(409).json({ error: `Room not available for ${err.date?.toISOString?.()?.split('T')[0]}` });
    }
    if (err?.code === 'ROOM_UNAVAILABLE') {
      return res.status(409).json({ error: `Room marked unavailable for ${err.date?.toISOString?.()?.split('T')[0]}` });
    }
    return res.status(500).json({ error: safeError(err) });
  }
}

router.post('/', authenticateJWT, createHotelBooking);

// Customer: list my hotel bookings
router.get('/customer/mine', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const where: any = { userId: req.user!.id, category: 'hotel' };
    if (status) where.status = status;
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        room: { select: { id: true, name: true, type: true, price: true, baseCurrency: true, bedConfig: true, roomNumber: true } },
        provider: { select: { id: true, businessName: true, address: true, city: true, slug: true, starRating: true } },
        payments: { select: { id: true, amount: true, method: true, status: true, paidAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ count: bookings.length, bookings });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Vendor: list bookings for my hotel
router.get('/vendor/mine', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const hotels = await prisma.serviceProvider.findMany({
      where: { userId: req.user!.id, category: 'hotel' },
      select: { id: true }
    });
    const hotelIds = hotels.map(h => h.id);
    const where: any = { providerId: { in: hotelIds }, category: 'hotel' };
    if (status) where.status = status;
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        room: { select: { id: true, name: true, type: true } },
        user: { select: { id: true, fullName: true, phone: true } },
        payments: { select: { id: true, amount: true, method: true, status: true, paidAt: true } }
      },
      orderBy: { travelDate: 'desc' }
    });
    return res.json({ count: bookings.length, bookings });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Customer: cancel my hotel booking (releases inventory + price snapshot preserved)
router.patch('/:bookingId/cancel', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.bookingId);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const booking = await prisma.booking.findUnique({ where: { id }, include: { provider: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.category !== 'hotel') return res.status(400).json({ error: 'Not a hotel booking' });
    const isOwner = booking.userId === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const isVendor = booking.provider?.userId === req.user!.id;
    if (!isOwner && !isAdmin && !isVendor) return res.status(403).json({ error: 'Access denied' });

    if (!canTransitionHotelBooking(booking.status, 'cancelled')) {
      return res.status(400).json({ error: `Cannot cancel status ${booking.status}` });
    }

    const reason = req.body?.reason ? String(req.body.reason) : null;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date(), rejectionReason: reason }
      });
      await tx.auditLog.create({
        data: {
          action: 'HOTEL_BOOKING_CANCELLED',
          actorId: req.user!.id,
          actorRole: req.user!.role,
          details: `Hotel booking ${booking.bookingCode} cancelled`,
          metadata: JSON.stringify({ bookingId: booking.id, providerId: booking.providerId })
        }
      });
      if (booking.roomId && booking.travelDate && booking.returnDate) {
        const dates = datesInRange(new Date(booking.travelDate), new Date(booking.returnDate));
        for (const d of dates) {
          const avail = await tx.hotelAvailability.findUnique({
            where: { roomId_date: { roomId: booking.roomId, date: d } }
          });
          if (avail && avail.bookedRooms > 0) {
            await tx.hotelAvailability.update({
              where: { id: avail.id },
              data: { bookedRooms: Math.max(0, avail.bookedRooms - (booking.numberOfRooms || 1)) }
            });
          }
        }
      }
      return updated;
    });

    const cancelUserId = booking?.userId;
    const cancelCode = booking?.bookingCode;
    if (cancelUserId) {
      void notifyUser(cancelUserId, 'HOTEL_BOOKING_CANCELLED', 'Hotel booking cancelled', `Your hotel booking ${cancelCode} has been cancelled.`);
    }
    return res.json({ message: 'Hotel booking cancelled', booking: result });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

// Get a single hotel booking by id (owner / vendor / admin)
router.get('/:bookingId', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.bookingId);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: { include: { ratePlans: { where: { isActive: true } } } },
        provider: { select: { id: true, businessName: true, city: true, address: true, phone: true, slug: true, userId: true } },
        user: { select: { id: true, fullName: true, phone: true, email: true } },
        payments: { select: { id: true, amount: true, method: true, status: true, paidAt: true } }
      }
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.category !== 'hotel') return res.status(400).json({ error: 'Not a hotel booking' });
    await prisma.$transaction(tx => expireHotelBookingIfNeeded(tx, booking));

    const isOwner = booking.userId === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const isVendor = booking.provider?.userId === req.user!.id;
    if (!isOwner && !isAdmin && !isVendor) return res.status(403).json({ error: 'Access denied' });

    return res.json({ booking });
  } catch (err: any) {
    return res.status(500).json({ error: safeError(err) });
  }
});

export default router;
