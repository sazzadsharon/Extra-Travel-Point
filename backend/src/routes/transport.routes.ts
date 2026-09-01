import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Shared seat-map helpers (mirror the canonical ones in booking.routes.ts
// so the bus endpoint can return authoritative seat availability without
// depending on the booking router's internals).
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

// 1. Vehicle Listing (Car, Microbus, CNG, Bike, Airport Transfer)
router.get('/vehicles', async (req, res) => {
  const { category, city } = req.query;
  return res.json([
    { id: 1, type: 'Car Rental', model: 'Toyota Premio (AC)', farePerKm: 45, baseFare: 500, capacity: 4, city: city || 'Dhaka' },
    { id: 2, type: 'Microbus Rental', model: 'Toyota HiAce', farePerKm: 70, baseFare: 1200, capacity: 11, city: city || 'Cox\'s Bazar' },
    { id: 3, type: 'CNG Auto', model: 'Bajaj 4-Stroke', farePerKm: 20, baseFare: 100, capacity: 3, city: city || 'Chittagong' },
    { id: 4, type: 'Bike Rental', model: 'Yamaha FZ-S', farePerKm: 15, baseFare: 80, capacity: 1, city: city || 'Sylhet' },
    { id: 5, type: 'Airport Transfer', model: 'Noah Hybrid VIP', fixedFare: 2500, route: 'Hazrat Shahjalal Airport -> City Hotel' }
  ]);
});

// 2. Fare Calculation API
router.post('/calculate-fare', async (req, res) => {
  const { vehicleType, distanceKm, isAirportTransfer } = req.body;
  let baseFare = vehicleType === 'microbus' ? 1200 : 500;
  let ratePerKm = vehicleType === 'microbus' ? 70 : 45;

  if (isAirportTransfer) {
    return res.json({ vehicleType, distanceKm, totalFare: 2500, currency: 'BDT', note: 'Airport Fixed Package' });
  }

  const estimatedFare = baseFare + (distanceKm * ratePerKm);
  return res.json({
    vehicleType,
    distanceKm,
    baseFare,
    ratePerKm,
    estimatedFare,
    currency: 'BDT'
  });
});

// 3. Driver Registration & Verification
router.post('/driver/register', authenticateJWT, async (req: AuthRequest, res) => {
  const { nidNumber, drivingLicense, vehicleNumber, vehicleType } = req.body;
  return res.status(201).json({
    message: 'Driver registration submitted successfully',
    driver: {
      userId: req.user!.id,
      nidNumber,
      drivingLicense,
      vehicleNumber,
      vehicleType,
      isVerified: false,
      status: 'PENDING_APPROVAL'
    }
  });
});

router.patch('/driver/:id/verify', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  return res.json({
    message: `Driver ID ${req.params.id} verified successfully`,
    isVerified: true
  });
});

// 4. Driver Dashboard & Ride Booking
router.get('/driver/dashboard', authenticateJWT, async (req: AuthRequest, res) => {
  return res.json({
    driverName: 'Kabir Hossain',
    vehicleNumber: 'DHAKA-METRO-GA-12-3456',
    completedRides: 48,
    todayEarningsBDT: 4200,
    commissionDeductedBDT: 420,
    driverNetPayoutBDT: 3780,
    rating: 4.9
  });
});

router.post('/ride/book', authenticateJWT, async (req: AuthRequest, res) => {
  const { vehicleId, pickupLocation, dropLocation, distanceKm, totalFare } = req.body;
  return res.status(201).json({
    bookingId: `RIDE-${Date.now()}`,
    status: 'DRIVER_ASSIGNED',
    driver: { name: 'Kabir Hossain', phone: '01711000000', vehicleNumber: 'DHAKA-METRO-GA-12-3456' },
    pickupLocation,
    dropLocation,
    totalFare
  });
});

// 5. Public DB-backed bus listing
// GET /api/v1/transport/buses
// Returns approved, active providers with at least one active bus service.
// Each bus includes its next 14 days of availability (date, startTime, endTime, capacity).
router.get('/buses', async (req, res) => {
  try {
    const { fromCity, toCity, date } = req.query;

    const services = await prisma.service.findMany({
      where: {
        category: 'bus',
        status: 'ACTIVE',
        isActive: true,
        provider: { status: 'APPROVED', isActive: true }
      },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            city: true,
            rating: true,
            totalReviews: true,
            isVerified: true
          }
        },
        availabilities: {
          where: { isActive: true },
          orderBy: { date: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const filtered = services
      .map(s => {
        const matchFrom = fromCity && s.provider.city
          ? s.provider.city.toLowerCase() === String(fromCity).toLowerCase()
          : true;
        const matchTo = toCity && s.route
          ? s.route.toLowerCase().includes(String(toCity).toLowerCase())
          : true;
        const matchDate = date
          ? s.availabilities.some(a => a.date.toISOString().split('T')[0] === String(date))
          : true;
        return { service: s, ok: matchFrom && matchTo && matchDate };
      })
      .filter(r => r.ok)
      .map(r => ({
        id: r.service.id,
        name: r.service.name,
        route: r.service.route,
        description: r.service.description,
        price: r.service.price,
        currency: r.service.currency,
        capacity: r.service.capacity,
        provider: r.service.provider,
        availability: r.service.availabilities.map(a => ({
          date: a.date.toISOString().split('T')[0],
          startTime: a.startTime,
          endTime: a.endTime,
          capacity: a.capacity
        }))
      }));

    return res.json({
      count: filtered.length,
      buses: filtered
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/transport/buses/:id
// Bus-specific detail endpoint used by the Bus MVP detail screen.
// Returns operator, route, price, capacity, and the next 14 days of
// availability with departure/arrival times.
router.get('/buses/:id', async (req, res) => {
  try {
    const busId = parseInt(req.params.id, 10);
    if (!Number.isFinite(busId) || busId <= 0) {
      return res.status(400).json({ error: 'Invalid bus id' });
    }

    const bus = await prisma.service.findFirst({
      where: {
        id: busId,
        category: 'bus',
        isActive: true,
        provider: { status: 'APPROVED', isActive: true }
      },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            category: true,
            description: true,
            address: true,
            city: true,
            phone: true,
            rating: true,
            totalReviews: true,
            isVerified: true
          }
        },
        availabilities: {
          where: { isActive: true },
          orderBy: { date: 'asc' }
        }
      }
    });

    if (!bus) return res.status(404).json({ error: 'Bus not found' });

    return res.json({
      id: bus.id,
      name: bus.name,
      route: bus.route,
      description: bus.description,
      price: bus.price,
      currency: bus.currency,
      capacity: bus.capacity ?? BUS_TOTAL_SEATS,
      provider: bus.provider,
      availability: bus.availabilities.map(a => ({
        date: a.date.toISOString().split('T')[0],
        startTime: a.startTime,
        endTime: a.endTime,
        capacity: a.capacity
      }))
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/transport/buses/:id/seats?date=YYYY-MM-DD
// Bus-specific seat availability. Mirrors /bookings/seats/map but uses the
// bus service as the seat source of truth. Booked seats for the bus (across
// all bookings for this provider/category/date) are marked unavailable.
router.get('/buses/:id/seats', async (req, res) => {
  try {
    const busId = parseInt(req.params.id, 10);
    if (!Number.isFinite(busId) || busId <= 0) {
      return res.status(400).json({ error: 'Invalid bus id' });
    }

    const date = typeof req.query.date === 'string' && req.query.date
      ? req.query.date
      : new Date().toISOString().split('T')[0];

    const bus = await prisma.service.findFirst({
      where: {
        id: busId,
        category: 'bus',
        isActive: true,
        provider: { status: 'APPROVED', isActive: true }
      }
    });

    if (!bus) return res.status(404).json({ error: 'Bus not found' });

    const totalSeats = bus.capacity ?? BUS_TOTAL_SEATS;
    const seats = buildBusSeatLayout(totalSeats);
    const unitPrice = bus.price;

    const occupied = new Set<string>();

    // 1. Stable base occupancy from the bus itself
    seats.forEach(seat => {
      const h = hashString(`${bus.id}:bus:${date}:${seat.seatNumber}`);
      if (h % 10 < 3) occupied.add(seat.seatNumber);
    });

    // 2. Overlay seats that are already booked for this provider/date
    const bookings = await prisma.booking.findMany({
      where: {
        providerId: bus.providerId,
        category: 'bus',
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

    // 3. Overlay active in-flight seat locks (held by other customers)
    const now = new Date();
    const activeLocks = await prisma.seatLock.findMany({
      where: {
        providerId: bus.providerId,
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
      busId: bus.id,
      date,
      totalSeats,
      availableSeats: availableCount,
      pricePerSeat: unitPrice,
      currency: bus.currency,
      seats: seatMap
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
