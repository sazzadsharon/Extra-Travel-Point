import { Router } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

// GET /api/v1/packages/super-bundles (Curated Bundles: Family, Couple, Group, Budget, Luxury)
router.get('/super-bundles', async (req, res) => {
  const { tripType, destination } = req.query;
  const dest = (destination as string) || 'Cox\'s Bazar';

  const bundles = [
    {
      id: 'BND-COUPLE-01',
      tripType: 'Couple',
      title: `${dest} Romantic Sunset Escape`,
      pricePerCouple: 12500,
      includes: ['Ac Royal Express Bus (2 Seats)', '5-Star Beach Resort (2 Nights)', 'Romantic Candlelight Seafood Dinner'],
      discountPercent: 15
    },
    {
      id: 'BND-FAMILY-02',
      tripType: 'Family',
      title: `${dest} Family Explorer Package`,
      pricePerFamily: 24000,
      includes: ['Private AC Microbus Rental', 'Family Suite Hotel (2 Rooms)', 'Sightseeing Tour Guide & Entry Passes'],
      discountPercent: 18
    },
    {
      id: 'BND-BUDGET-03',
      tripType: 'Budget',
      title: `${dest} Backpacker Special`,
      pricePerPerson: 3800,
      includes: ['Non-AC Deluxe Bus', 'Standard Guest House Stay', 'Local Transport Pass'],
      discountPercent: 10
    },
    {
      id: 'BND-LUXURY-04',
      tripType: 'Luxury',
      title: `${dest} Executive VIP Helicopter & Luxury Villa`,
      pricePerPerson: 45000,
      includes: ['VIP Air Transfer / Flight', '5-Star Oceanfront Villa', 'Private Yacht & Chef Service'],
      discountPercent: 20
    }
  ];

  return res.json({
    destination: dest,
    filterTripType: tripType || 'ALL',
    bundles: tripType ? bundles.filter(b => b.tripType.toLowerCase() === (tripType as string).toLowerCase()) : bundles
  });
});

// POST /api/v1/packages/one-click-booking (One-Click Trip Booking for Bundles)
router.post('/one-click-booking', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const { bundleId, numberOfPeople, travelDate, customRequests } = req.body;

    const bookingCode = `ETP-SUPER-${Date.now()}`;
    const totalAmount = 12500;
    const discountAmount = 1875;
    const finalAmount = totalAmount - discountAmount;

    return res.status(201).json({
      success: true,
      message: 'One-Click Super App Package Booked Successfully!',
      bookingDetails: {
        bookingCode,
        userId: req.user!.id,
        bundleId: bundleId || 'BND-COUPLE-01',
        numberOfPeople: numberOfPeople || 2,
        travelDate: travelDate || new Date().toISOString().split('T')[0],
        totalAmount,
        discountAmount,
        finalAmount,
        customRequests,
        status: 'CONFIRMED',
        paymentStatus: 'PAID_VIA_ETP_WALLET'
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
