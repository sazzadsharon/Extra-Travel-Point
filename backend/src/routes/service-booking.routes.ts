import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { notifyUser } from '../utils/notifications';

const router = Router();

const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const bookServiceSchema = z.object({
  bookingDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'Invalid bookingDate'
  }),
  quantity: z.number().int().positive().max(50).default(1),
  passengers: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        age: z.number().optional(),
        gender: z.enum(['male', 'female', 'other']).optional()
      })
    )
    .optional(),
  specialRequest: z.string().max(500).optional()
});

function parseAvailableDays(value: string | null | undefined): number[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((d) => typeof d === 'number' && d >= 0 && d <= 6)) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// GET /api/v1/services/:id  (PUBLIC, safe fields only)
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid service id' });
    }

    const service = await prisma.service.findFirst({
      where: {
        id,
        lifecycleStatus: 'PUBLISHED',
        isActive: true,
        provider: { status: 'APPROVED', isActive: true }
      },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            category: true,
            city: true,
            logo: true,
            rating: true,
            totalReviews: true,
            isVerified: true
          }
        }
      }
    });

    if (!service) return res.status(404).json({ error: 'Service not found' });

    const images = service.images
      ? (() => {
          try {
            const parsed = JSON.parse(service.images);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

    return res.json({
      id: service.id,
      providerId: service.providerId,
      name: service.name,
      serviceType: service.serviceType,
      category: service.category,
      description: service.description,
      route: service.route,
      price: service.price,
      currency: service.currency,
      capacity: service.capacity,
      locationCity: service.locationCity,
      locationAddress: service.locationAddress,
      latitude: service.latitude,
      longitude: service.longitude,
      images,
      availableDays: parseAvailableDays(service.availableDays),
      startDate: service.startDate,
      endDate: service.endDate,
      provider: service.provider
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/services/:id/book  (CUSTOMER booking)
// Server is authoritative for:
//   - service existence / lifecycle / active state
//   - provider (vendor) approval & active status
//   - providerId (NEVER trusted from client)
//   - unitPrice (NEVER trusted from client)
router.post('/:id/book', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid service id' });
    }

    const parse = bookServiceSchema.safeParse(req.body || {});
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { bookingDate, quantity, passengers, specialRequest } = parse.data;

    const service = await prisma.service.findUnique({
      where: { id },
      include: { provider: true }
    });
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Lifecycle: only PUBLISHED services can be booked.
    if (service.lifecycleStatus !== 'PUBLISHED') {
      return res.status(403).json({
        error: `Service is not bookable (status: ${service.lifecycleStatus})`
      });
    }

    // Active flag.
    if (!service.isActive || service.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Service is not active' });
    }

    // Vendor must be APPROVED + active.
    const provider = service.provider;
    if (!provider || provider.status !== 'APPROVED' || !provider.isActive) {
      return res.status(403).json({ error: 'Service vendor is not approved or inactive' });
    }

    // Date validity.
    const bookingDateObj = new Date(bookingDate);
    if (isNaN(bookingDateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid booking date' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDay = new Date(bookingDateObj);
    bookingDay.setHours(0, 0, 0, 0);
    if (bookingDay < today) {
      return res.status(400).json({ error: 'Booking date cannot be in the past' });
    }

    if (service.startDate) {
      const start = new Date(service.startDate);
      start.setHours(0, 0, 0, 0);
      if (bookingDay < start) {
        return res.status(400).json({ error: 'Booking date is before service start date' });
      }
    }
    if (service.endDate) {
      const end = new Date(service.endDate);
      end.setHours(0, 0, 0, 0);
      if (bookingDay > end) {
        return res.status(400).json({ error: 'Booking date is after service end date' });
      }
    }

    // Available days check.
    const allowedDays = parseAvailableDays(service.availableDays);
    if (allowedDays && allowedDays.length > 0) {
      const dow = bookingDay.getDay();
      if (!allowedDays.includes(dow)) {
        return res.status(400).json({
          error: `Service is not available on ${dayNames[dow]}. Allowed days: ${allowedDays
            .map((d) => dayNames[d])
            .join(', ')}`
        });
      }
    }

    // Capacity.
    if (service.capacity != null && quantity > service.capacity) {
      return res.status(400).json({
        error: `Requested quantity (${quantity}) exceeds service capacity (${service.capacity})`
      });
    }

    // Day-level availability override (optional).
    const dayAvailability = await prisma.serviceAvailability.findFirst({
      where: {
        serviceId: service.id,
        date: bookingDay,
        isActive: true
      }
    });
    if (dayAvailability) {
      if (
        dayAvailability.capacity != null &&
        quantity > dayAvailability.capacity
      ) {
        return res.status(400).json({
          error: `Requested quantity exceeds capacity (${dayAvailability.capacity}) for ${bookingDate}`
        });
      }
    }

    // SERVER-AUTHORITATIVE PRICE: ignore any client-supplied price/totalAmount.
    const unitPrice = service.price;
    const computedFare = unitPrice * quantity;

    const categoryMap: Record<string, string> = {
      BUS: 'bus',
      HOTEL: 'hotel',
      RESTAURANT: 'food',
      TOUR: 'tour',
      ACTIVITY: 'tour',
      CAR_RENTAL: 'bus',
      BOAT: 'bus',
      TRANSPORT: 'bus',
      OTHER: 'tour'
    };
    const category = categoryMap[service.serviceType] || 'tour';

    const booking = await prisma.booking.create({
      data: {
        userId: req.user!.id,
        providerId: provider.id,
        serviceId: service.id,
        category,
        bookingDate: bookingDateObj,
        travelDate: bookingDateObj,
        numberOfPeople: quantity,
        totalAmount: computedFare,
        discountAmount: 0,
        finalAmount: computedFare,
        passengerInfo: passengers && passengers.length > 0 ? JSON.stringify(passengers) : null,
        specialRequest: specialRequest ?? null,
        route: service.route ?? null,
        status: 'pending',
        paymentStatus: 'pending'
      },
      include: {
        provider: { select: { id: true, businessName: true, userId: true } },
        service: {
          select: { id: true, name: true, serviceType: true, price: true, currency: true }
        }
      }
    });

    notifyUser(
      booking.provider.userId,
      'NEW_SERVICE_BOOKING',
      'New Service Booking',
      `Service booking #${booking.bookingCode} for ${service.name} on ${bookingDay.toISOString().split('T')[0]}`
    );

    return res.status(201).json({
      message: 'Service booking created successfully',
      booking
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;