import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const reviewSchema = z.object({
  bookingId: z.number(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
});

// POST /api/v1/reviews
router.post('/', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const parse = reviewSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const { bookingId, rating, comment } = parse.data;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const providerId = booking.providerId;

    const review = await prisma.review.create({
      data: {
        userId: req.user!.id,
        bookingId,
        rating,
        comment
      }
    });

    const avgRating = await prisma.review.aggregate({
      where: { booking: { providerId } },
      _avg: { rating: true }
    });

    const averageRating = avgRating._avg?.rating ?? 0;

    await prisma.serviceProvider.update({
      where: { id: providerId },
      data: {
        rating: averageRating,
        totalReviews: { increment: 1 }
      }
    });

    return res.status(201).json({
      message: 'Review submitted successfully',
      review
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/reviews/provider/:providerId
router.get('/provider/:providerId', async (req, res) => {
  try {
    const providerId = parseInt(req.params.providerId);
    const reviews = await prisma.review.findMany({
      where: { booking: { providerId } },
      include: { user: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const avgRating = await prisma.review.aggregate({
      where: { booking: { providerId } },
      _avg: { rating: true },
      _count: { rating: true }
    });

    const averageRating = avgRating._avg?.rating ?? 0;
    const totalReviews = avgRating._count?.rating ?? 0;

    return res.json({
      averageRating,
      totalReviews,
      reviews
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
