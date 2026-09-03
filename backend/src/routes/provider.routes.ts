import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { resolveCommissionRate } from '../utils/commission';

const router = Router();

// Input validation for provider creation
const providerCreateSchema = z.object({
  businessName: z.string().min(2).max(200),
  category: z.string().min(1).max(50),
  address: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  commissionRate: z.number().min(0).max(100).optional()
});

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
    const commissionRate = await resolveCommissionRate({ providerRate: provider?.commissionRate });
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

// GET /api/v1/providers (Public list - no private data exposed)
router.get('/', async (req, res) => {
  try {
    const providers = await prisma.serviceProvider.findMany({
      where: { status: 'APPROVED', isActive: true },
      select: {
        id: true,
        businessName: true,
        category: true,
        description: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        isVerified: true,
        createdAt: true,
        user: {
          select: {
            fullName: true
            // email and phone are NOT exposed publicly
          }
        }
      }
    });
    return res.json(providers);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/providers/:id (Public details - no private data exposed)
router.get('/:id', async (req, res) => {
  try {
    const provider = await prisma.serviceProvider.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        businessName: true,
        category: true,
        description: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        isVerified: true,
        status: true,
        createdAt: true,
        services: {
          where: { status: 'ACTIVE', isActive: true },
          select: {
            id: true,
            name: true,
            category: true,
            description: true,
            route: true,
            price: true,
            capacity: true
          }
        },
        user: {
          select: {
            fullName: true
            // email and phone are NOT exposed publicly
          }
        }
      }
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
    const parse = providerCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { businessName, category, address, latitude, longitude, commissionRate } = parse.data;

    // Check for duplicate provider for this user
    const existingProvider = await prisma.serviceProvider.findFirst({
      where: { userId: req.user!.id }
    });
    if (existingProvider) {
      return res.status(409).json({ error: 'User already has a provider account' });
    }

    const provider = await prisma.serviceProvider.create({
      data: {
        userId: req.user!.id,
        businessName,
        category,
        address,
        latitude: latitude || null,
        longitude: longitude || null,
        // Only admins can set commissionRate; vendors get default
        commissionRate: req.user!.role === 'admin' && commissionRate ? commissionRate : 10.00,
        status: 'PENDING',
        isVerified: false,
        isActive: false
      }
    });

    return res.status(201).json(provider);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
