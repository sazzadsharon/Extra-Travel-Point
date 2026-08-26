import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/v1/providers/dashboard/stats (Vendor Dashboard Stats)
router.get('/dashboard/stats', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const provider = await prisma.serviceProvider.findFirst({
      where: { userId: req.user!.id }
    });

    if (!provider && req.user!.role !== 'admin') {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const providerId = provider?.id;

    const bookings = await prisma.booking.findMany({
      where: providerId ? { providerId } : {},
      include: { payments: true }
    });

    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed' || b.status === 'confirmed').length;
    const totalSales = bookings.reduce((sum, b) => sum + (b.paymentStatus === 'paid' ? b.finalAmount : 0), 0);
    const commissionRate = provider?.commissionRate || 10.0;
    const totalCommission = (totalSales * commissionRate) / 100;
    const netPayout = totalSales - totalCommission;

    return res.json({
      providerId,
      businessName: provider?.businessName || 'Admin Overview',
      totalBookings,
      completedBookings,
      totalSales,
      commissionRate,
      totalCommission,
      netPayout,
      recentBookings: bookings.slice(0, 5)
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/providers/dashboard/payouts (Payout History)
router.get('/dashboard/payouts', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    return res.json({
      payouts: [
        { id: 'PAY-1001', amount: 15400, status: 'completed', date: new Date().toISOString(), method: 'bKash Merchant' },
        { id: 'PAY-1002', amount: 28900, status: 'pending', date: new Date().toISOString(), method: 'Bank Wire' }
      ]
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/providers (Public list)
router.get('/', async (req, res) => {
  try {
    const providers = await prisma.serviceProvider.findMany({
      include: {
        user: { select: { fullName: true, email: true, phone: true } }
      }
    });
    return res.json(providers);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/providers/:id
router.get('/:id', async (req, res) => {
  try {
    const provider = await prisma.serviceProvider.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: true }
    });
    if (!provider) return res.status(404).json({ error: 'Service provider not found' });
    return res.json(provider);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/providers (Create provider / Vendor setup)
router.post('/', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { businessName, category, address, latitude, longitude, commissionRate } = req.body;

    const provider = await prisma.serviceProvider.create({
      data: {
        userId: req.user!.id,
        businessName,
        category,
        address,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        commissionRate: commissionRate ? parseFloat(commissionRate) : 10.00
      }
    });

    return res.status(201).json(provider);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
