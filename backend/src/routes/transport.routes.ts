import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

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

export default router;
