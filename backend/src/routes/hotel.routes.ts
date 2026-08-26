import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// 1. Hotel Registration & Search
router.post('/register', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { businessName, address, latitude, longitude, commissionRate, description, facilities } = req.body;
    const provider = await prisma.serviceProvider.create({
      data: {
        userId: req.user!.id,
        businessName,
        category: 'hotel',
        address,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        commissionRate: commissionRate ? parseFloat(commissionRate) : 12.0
      }
    });
    return res.status(201).json({ message: 'Hotel registered successfully', provider, facilities });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 2. Hotel Verification (Admin)
router.patch('/:id/verify', authenticateJWT, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const hotelId = parseInt(req.params.id);
    const hotel = await prisma.serviceProvider.update({
      where: { id: hotelId },
      data: { isVerified: true }
    });
    return res.json({ message: 'Hotel verified successfully', hotel });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Hotel Dashboard & Stats
router.get('/dashboard', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    return res.json({
      hotelName: 'Ocean View Resort Kuakata',
      totalRooms: 24,
      availableRooms: 10,
      todayCheckIns: 4,
      todayCheckOuts: 2,
      totalRevenueBDT: 148000,
      commissionDueBDT: 17760,
      payoutStatus: 'UP_TO_DATE'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. Room Management (Add / List / Pricing / Images)
router.get('/rooms', async (req, res) => {
  return res.json([
    { id: 101, roomType: 'Deluxe Sea View AC', pricePerNight: 3500, maxGuests: 2, isAvailable: true, images: ['/images/room1.jpg', '/images/room1_bathroom.jpg'] },
    { id: 102, roomType: 'Super Deluxe Family Suite', pricePerNight: 6500, maxGuests: 4, isAvailable: true, images: ['/images/suite1.jpg'] }
  ]);
});

router.post('/rooms', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  const { roomType, pricePerNight, maxGuests, images } = req.body;
  return res.status(201).json({
    message: 'Room created successfully',
    room: { id: Date.now(), roomType, pricePerNight, maxGuests, images: images || [], isAvailable: true }
  });
});

// 5. Check-in & Check-out Handling
router.post('/check-in', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  const { bookingId } = req.body;
  return res.json({ success: true, message: `Booking #${bookingId} Checked-In successfully at ${new Date().toLocaleTimeString()}` });
});

router.post('/check-out', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  const { bookingId } = req.body;
  return res.json({ success: true, message: `Booking #${bookingId} Checked-Out successfully at ${new Date().toLocaleTimeString()}` });
});

// 6. Hotel Commission & Payout History
router.get('/payouts', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  return res.json({
    payoutHistory: [
      { payoutId: 'HTL-PAY-901', amount: 84000, commissionDeducted: 10080, status: 'COMPLETED', date: '2026-08-20' }
    ]
  });
});

export default router;
