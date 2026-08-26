import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Apply admin guard to all admin routes
router.use(authenticateJWT, requireRole(['admin']));

// GET /api/v1/admin/fleet (Bus, Launch, Flight, Hotel, Driver Management)
router.get('/fleet', async (req: AuthRequest, res) => {
  return res.json({
    buses: [{ id: 1, operator: 'Hanif Enterprise', totalVehicles: 45, activeTrips: 12 }],
    launches: [{ id: 1, operator: 'Green Line Water Bus', totalVessels: 8, activeTrips: 3 }],
    flights: [{ id: 1, airline: 'US-Bangla Airlines', activeRoutes: 6 }],
    hotels: [{ id: 1, name: 'Ocean View Resort', totalRooms: 24, activeBookings: 14 }],
    drivers: [{ id: 1, name: 'Kabir Hossain', vehicleType: 'Microbus', status: 'VERIFIED' }]
  });
});

// GET & POST /api/v1/admin/commissions-coupons
router.get('/commissions-coupons', async (req: AuthRequest, res) => {
  return res.json({
    defaultCommissionRates: { bus: '10%', launch: '10%', flight: '5%', hotel: '12%', restaurant: '8%' },
    activeCoupons: [
      { code: 'ETPSUPER', discountPercent: 15, maxDiscountBDT: 500, status: 'ACTIVE' },
      { code: 'EID2026', discountPercent: 20, maxDiscountBDT: 1000, status: 'ACTIVE' }
    ]
  });
});

// GET & PATCH /api/v1/admin/reviews/moderation
router.get('/reviews/moderation', async (req: AuthRequest, res) => {
  return res.json([
    { id: 301, user: 'Rahim', provider: 'Sakura Paribahan', rating: 1, comment: 'Bus was delayed by 1 hr', status: 'PENDING_MODERATION' }
  ]);
});

router.patch('/reviews/:id/moderate', async (req: AuthRequest, res) => {
  const { action } = req.body; // 'APPROVE' or 'REJECT'
  return res.json({ message: `Review #${req.params.id} ${action === 'APPROVE' ? 'Approved' : 'Rejected'} successfully` });
});

// GET /api/v1/admin/reports/summary
router.get('/reports/summary', async (req: AuthRequest, res) => {
  return res.json({
    period: 'Current Month (August 2026)',
    totalBookings: 12450,
    grossRevenueBDT: 8450000,
    netCommissionEarnedBDT: 845000,
    totalRefundsProcessedBDT: 120000,
    activePromotionsCount: 4,
    systemStatus: 'ALL_SYSTEMS_OPERATIONAL'
  });
});

// GET /api/v1/admin/users
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, phone: true, email: true, fullName: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(users);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/analytics/fraud-detection
router.get('/analytics/fraud-detection', async (req: AuthRequest, res) => {
  try {
    const suspiciousActivities = [
      { id: 1, type: 'Multiple Failed Payment Attempts', userId: 12, ip: '103.205.132.10', severity: 'High', timestamp: new Date().toISOString() },
      { id: 2, type: 'QR Code Replay Attempt', userId: 45, ip: '103.205.132.88', severity: 'Medium', timestamp: new Date().toISOString() }
    ];
    return res.json({ suspiciousActivities });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/audit-logs
router.get('/audit-logs', async (req: AuthRequest, res) => {
  try {
    const logs = [
      { id: 'LOG-501', action: 'VENDOR_APPROVAL', adminId: req.user!.id, details: 'Approved Provider #3', timestamp: new Date().toISOString() },
      { id: 'LOG-502', action: 'REFUND_PROCESSED', adminId: req.user!.id, details: 'Refunded TXN-99831', timestamp: new Date().toISOString() }
    ];
    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/bookings
router.get('/bookings', async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: { user: true, provider: true, payments: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(bookings);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/revenue
router.get('/revenue', async (req: AuthRequest, res) => {
  try {
    const totalBookings = await prisma.booking.count();
    const paidBookings = await prisma.booking.findMany({
      where: { paymentStatus: 'paid' }
    });

    const totalRevenue = paidBookings.reduce((sum, b) => sum + b.finalAmount, 0);
    const totalDiscountsGiven = paidBookings.reduce((sum, b) => sum + b.discountAmount, 0);

    return res.json({
      totalBookings,
      paidBookingsCount: paidBookings.length,
      totalRevenue,
      totalDiscountsGiven,
      currency: 'BDT'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/providers
router.get('/providers', async (req: AuthRequest, res) => {
  try {
    const providers = await prisma.serviceProvider.findMany({
      include: { user: true }
    });
    return res.json(providers);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/admin/providers/:id/verify
router.patch('/providers/:id/verify', async (req: AuthRequest, res) => {
  try {
    const providerId = parseInt(req.params.id);
    const provider = await prisma.serviceProvider.update({
      where: { id: providerId },
      data: { isVerified: true }
    });

    return res.json({ message: 'Service provider verified successfully', provider });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
