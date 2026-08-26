import { Router } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/v1/reviews
router.post('/', authenticateJWT, async (req: AuthRequest, res) => {
  const { providerId, bookingId, rating, comment } = req.body;
  return res.status(201).json({
    message: 'Review submitted successfully',
    review: {
      id: Date.now(),
      userId: req.user!.id,
      providerId,
      bookingId,
      rating,
      comment,
      createdAt: new Date()
    }
  });
});

// GET /api/v1/reviews/provider/:providerId
router.get('/provider/:providerId', async (req, res) => {
  return res.json({
    averageRating: 4.7,
    totalReviews: 124,
    reviews: [
      { id: 101, userName: 'Rahim Uddin', rating: 5, comment: 'Excellent bus service and clean seats!', date: new Date() }
    ]
  });
});

export default router;
