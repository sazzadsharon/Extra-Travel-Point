import { Router } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/v1/loyalty/points (Enhanced Membership & ETP Points)
router.get('/points', authenticateJWT, async (req: AuthRequest, res) => {
  const totalPoints = 1250;
  let tier = 'Silver';
  if (totalPoints >= 2000) tier = 'Platinum';
  else if (totalPoints >= 1000) tier = 'Gold';

  return res.json({
    userId: req.user!.id,
    totalPoints,
    membershipTier: tier,
    tierBenefits: {
      Silver: '5% Extra Points on Booking',
      Gold: '10% Extra Points + Priority Support',
      Platinum: '15% Extra Points + Free Seat Upgrade'
    }[tier],
    redeemableValueBDT: Math.floor(totalPoints / 2),
    cashbackBalanceBDT: 350
  });
});

// POST /api/v1/loyalty/coupons/apply (Coupon & Promo Code Validation)
router.post('/coupons/apply', authenticateJWT, async (req: AuthRequest, res) => {
  const { promoCode, bookingAmount } = req.body;
  const validPromos: Record<string, { discountPercent: number; maxDiscount: number }> = {
    'ETPSUPER': { discountPercent: 15, maxDiscount: 500 },
    'EID2026': { discountPercent: 20, maxDiscount: 1000 },
    'GOLDMEMBER': { discountPercent: 10, maxDiscount: 300 }
  };

  const promo = validPromos[promoCode?.toUpperCase()];
  if (!promo) {
    return res.status(400).json({ error: 'Invalid or expired promo code' });
  }

  const calculatedDiscount = (bookingAmount * promo.discountPercent) / 100;
  const discountAmount = Math.min(calculatedDiscount, promo.maxDiscount);

  return res.json({
    success: true,
    promoCode: promoCode.toUpperCase(),
    discountAmount,
    finalAmount: bookingAmount - discountAmount,
    message: `${promo.discountPercent}% Promo discount applied successfully!`
  });
});

// GET /api/v1/loyalty/history (Reward History)
router.get('/history', authenticateJWT, async (req: AuthRequest, res) => {
  return res.json({
    history: [
      { id: 101, type: 'CASHBACK_EARNED', points: 250, amountBDT: 125, description: 'Cashback for Cox\'s Bazar Hotel Booking', date: new Date() },
      { id: 102, type: 'REFERRAL_BONUS', points: 500, amountBDT: 250, description: 'Referral bonus for user registration', date: new Date() },
      { id: 103, type: 'PROMO_REDEEMED', points: -300, amountBDT: -150, description: 'Redeemed on Bus Booking #BKG-8812', date: new Date() }
    ]
  });
});

// GET /api/v1/loyalty/referral
router.get('/points', authenticateJWT, async (req: AuthRequest, res) => {
  return res.json({
    userId: req.user!.id,
    totalPoints: 450,
    tier: 'Gold Member',
    redeemableValueBDT: 225,
    history: [
      { id: 1, action: 'Booking Cashback', points: 150, date: new Date() },
      { id: 2, action: 'Referral Bonus', points: 300, date: new Date() }
    ]
  });
});

// GET /api/v1/loyalty/referral
router.get('/referral', authenticateJWT, async (req: AuthRequest, res) => {
  return res.json({
    referralCode: `ETP-REF-${req.user!.id * 777}`,
    referralLink: `https://extratravelpoint.com/register?ref=ETP-REF-${req.user!.id * 777}`,
    totalReferredUsers: 5,
    totalEarnedPoints: 500
  });
});

export default router;
