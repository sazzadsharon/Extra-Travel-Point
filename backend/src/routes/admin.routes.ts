import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole, isMasterAdmin } from '../middleware/auth';
import { getVendorBalance, resolveCommissionRate } from '../utils/commission';

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
      select: { id: true, phone: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(users);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/admin/users/:id/toggle
router.patch('/users/:id/toggle', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin' || isMasterAdmin({ id: user.id, phone: user.phone, role: user.role })) {
      return res.status(403).json({ error: 'Cannot deactivate an administrator account' });
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true }
    });
    return res.json({ message: 'User status updated', user: updated });
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
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return res.json(logs.map(l => ({
      id: l.id,
      action: l.action,
      adminId: l.actorId,
      details: l.details,
      timestamp: l.createdAt.toISOString()
    })));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/bookings
router.get('/bookings', async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      select: {
        id: true,
        bookingCode: true,
        status: true,
        paymentStatus: true,
        finalAmount: true,
        createdAt: true,
        category: true,
        travelDate: true
      },
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
    const [totalBookings, paidBookings] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.findMany({
        where: { paymentStatus: 'paid' },
        select: { finalAmount: true, discountAmount: true }
      })
    ]);

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

// GET /api/v1/admin/vendors (Vendor list with optional status filter)
router.get('/vendors', async (req: AuthRequest, res) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (typeof status === 'string') where.status = status;

    const providers = await prisma.serviceProvider.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        _count: { select: { services: true, bookings: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const counts = await prisma.serviceProvider.groupBy({ by: ['status'], _count: { id: true } });

    return res.json({ providers, counts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/vendors/:id (Vendor details)
router.get('/vendors/:id', async (req: AuthRequest, res) => {
  try {
    const providerId = parseInt(req.params.id);
    const provider = await prisma.serviceProvider.findUnique({
      where: { id: providerId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
        services: { orderBy: { createdAt: 'desc' } },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { user: { select: { id: true, fullName: true, phone: true } }, service: true }
        }
      }
    });

    if (!provider) return res.status(404).json({ error: 'Vendor not found' });

    return res.json(provider);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/vendors/:id/balance
// Reuses the authoritative settlement-ledger balance. Never trusted
// from the client — purely server-derived.
router.get('/vendors/:id/balance', async (req: AuthRequest, res) => {
  try {
    const providerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(providerId) || providerId <= 0) {
      return res.status(400).json({ error: 'Invalid vendor id' });
    }
    const provider = await prisma.serviceProvider.findUnique({
      where: { id: providerId },
      select: { id: true, status: true, isActive: true, kycStatus: true, commissionRate: true }
    });
    if (!provider) return res.status(404).json({ error: 'Vendor not found' });

    const balance = await getVendorBalance(providerId);
    const effectiveRate = await resolveCommissionRate({ providerRate: provider.commissionRate });
    return res.json({ provider, balance, commissionRate: effectiveRate });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
async function setVendorStatus(res: any, providerId: number, adminId: number, status: string, extra: Record<string, any> = {}) {
  try {
    const provider = await prisma.serviceProvider.update({
      where: { id: providerId },
      data: { status, reviewedBy: adminId, verifiedAt: new Date(), isVerified: status === 'APPROVED', isActive: status === 'APPROVED', ...extra }
    });
    return res.json({ message: `Vendor ${status.toLowerCase()} successfully`, provider });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

// PATCH /api/v1/admin/vendors/:id/approve
router.patch('/vendors/:id/approve', async (req: AuthRequest, res) => {
  return setVendorStatus(res, parseInt(req.params.id), req.user!.id, 'APPROVED');
});

// PATCH /api/v1/admin/vendors/:id/reject
router.patch('/vendors/:id/reject', async (req: AuthRequest, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
  return setVendorStatus(res, parseInt(req.params.id), req.user!.id, 'REJECTED', { rejectionReason: reason });
});

// PATCH /api/v1/admin/vendors/:id/suspend
router.patch('/vendors/:id/suspend', async (req: AuthRequest, res) => {
  return setVendorStatus(res, parseInt(req.params.id), req.user!.id, 'SUSPENDED');
});

// PATCH /api/v1/admin/vendors/:id/restore
router.patch('/vendors/:id/restore', async (req: AuthRequest, res) => {
  return setVendorStatus(res, parseInt(req.params.id), req.user!.id, 'APPROVED');
});

// GET /api/v1/admin/providers (legacy list, kept for compatibility)
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

// PATCH /api/v1/admin/providers/:id/verify (legacy verify -> APPROVED)
router.patch('/providers/:id/verify', async (req: AuthRequest, res) => {
  try {
    const providerId = parseInt(req.params.id);
    const provider = await prisma.serviceProvider.update({
      where: { id: providerId },
      data: { isVerified: true, status: 'APPROVED', reviewedBy: req.user!.id, verifiedAt: new Date(), isActive: true }
    });

    return res.json({ message: 'Service provider verified successfully', provider });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
