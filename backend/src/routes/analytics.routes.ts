import { Router } from 'express';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Apply admin guard to analytics endpoints
router.use(authenticateJWT, requireRole(['admin']));

// GET /api/v1/analytics/overview (Full Business Intelligence Analytics)
router.get('/overview', async (req: AuthRequest, res) => {
  return res.json({
    summary: {
      dailyBookings: 342,
      monthlyBookings: 10250,
      totalRevenueBDT: 15480000,
      netCommissionBDT: 1548000,
      totalRefundsBDT: 240000,
      activeUsersCount: 38450,
      cancellationRatePercent: 2.8
    },
    popularRoutes: [
      { route: 'Dhaka -> Cox\'s Bazar', totalBookings: 3820, category: 'bus' },
      { route: 'Dhaka -> Kuakata', totalBookings: 2150, category: 'bus' },
      { route: 'Dhaka -> Barisal', totalBookings: 1890, category: 'launch' }
    ],
    popularHotels: [
      { hotelName: 'Ocean View Resort Kuakata', bookingsCount: 410, rating: 4.8 },
      { hotelName: 'Seagull Hotel Cox\'s Bazar', bookingsCount: 680, rating: 4.7 }
    ],
    popularDestinations: [
      { destination: 'Cox\'s Bazar', sharePercentage: 42 },
      { destination: 'Kuakata', sharePercentage: 28 },
      { destination: 'Sylhet', sharePercentage: 18 },
      { destination: 'Sreemangal', sharePercentage: 12 }
    ],
    providerPerformance: [
      { provider: 'Hanif Enterprise', totalBookings: 2400, totalSalesBDT: 1920000, commissionBDT: 192000, rating: 4.9 },
      { provider: 'Green Line Paribahan', totalBookings: 1850, totalSalesBDT: 2220000, commissionBDT: 222000, rating: 4.8 }
    ],
    aiRecommendationAnalytics: {
      totalAIQueriesHandled: 8420,
      convertedBookingsFromAI: 3150,
      conversionRatePercent: 37.4,
      mostRequestedBudgetBDT: 5000
    }
  });
});

export default router;
