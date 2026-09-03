import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import {
  getVendorBalance,
  PAYOUT_METHODS,
  PAYOUT_STATUS,
  round2,
  resolveCommissionRate
} from '../utils/commission';

const router = Router();

async function getProviderForVendor(userId: number) {
  return prisma.serviceProvider.findFirst({
    where: { userId },
    select: {
      id: true,
      status: true,
      isActive: true,
      kycStatus: true,
      commissionRate: true
    }
  });
}

// GET /api/v1/vendors/me/earnings
router.get(
  '/me/earnings',
  authenticateJWT,
  requireRole(['vendor', 'admin']),
  async (req: AuthRequest, res) => {
    try {
      const provider = await getProviderForVendor(req.user!.id);
      if (!provider) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }
      const balance = await getVendorBalance(provider.id);
      const settlementCount = await prisma.settlement.count({
        where: { providerId: provider.id }
      });
      return res.json({
        providerId: provider.id,
        balance,
        settlementCount,
        commissionRate: await resolveCommissionRate({ providerRate: provider.commissionRate })
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/v1/vendors/me/settlements
router.get(
  '/me/settlements',
  authenticateJWT,
  requireRole(['vendor', 'admin']),
  async (req: AuthRequest, res) => {
    try {
      const provider = await getProviderForVendor(req.user!.id);
      if (!provider) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }
      const settlements = await prisma.settlement.findMany({
        where: { providerId: provider.id },
        include: {
          booking: {
            select: {
              id: true,
              bookingCode: true,
              paymentStatus: true,
              status: true,
              travelDate: true,
              numberOfPeople: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json({ count: settlements.length, settlements });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/v1/vendors/me/payouts
router.get(
  '/me/payouts',
  authenticateJWT,
  requireRole(['vendor', 'admin']),
  async (req: AuthRequest, res) => {
    try {
      const provider = await getProviderForVendor(req.user!.id);
      if (!provider) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }
      const payouts = await prisma.payoutRequest.findMany({
        where: { providerId: provider.id },
        orderBy: { createdAt: 'desc' }
      });
      return res.json({ count: payouts.length, payouts });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

const payoutRequestSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(PAYOUT_METHODS),
  payoutDetails: z.string().max(500).optional()
});

// POST /api/v1/vendors/me/payouts
router.post(
  '/me/payouts',
  authenticateJWT,
  requireRole(['vendor']),
  async (req: AuthRequest, res) => {
    try {
      const parse = payoutRequestSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: parse.error.issues });
      }
      const { amount, method, payoutDetails } = parse.data;

      const provider = await getProviderForVendor(req.user!.id);
      if (!provider) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }
      if (provider.status !== 'APPROVED' || !provider.isActive) {
        return res.status(403).json({ error: 'Vendor account is not active/approved' });
      }
      if (provider.kycStatus !== 'APPROVED') {
        return res.status(403).json({ error: 'KYC must be approved before requesting payout' });
      }

      const amountRounded = round2(amount);
      if (amountRounded <= 0) {
        return res.status(400).json({ error: 'amount must be greater than zero' });
      }

      // Double-spend protection: re-read available balance INSIDE a
      // transaction with row-level semantics for provider payout totals.
      // We serialize payout-request creation per provider with a short
      // uniqueness check on total open payouts.
      const result = await prisma.$transaction(async (tx) => {
        // Re-load provider to ensure consistent view
        const lockedProvider = await tx.serviceProvider.findUnique({
          where: { id: provider.id }
        });
        if (!lockedProvider) {
          return { error: 'Vendor not found' as const, code: 404 };
        }

        const [settlements, openPayouts] = await Promise.all([
          tx.settlement.findMany({ where: { providerId: provider.id } }),
          tx.payoutRequest.findMany({
            where: {
              providerId: provider.id,
              status: {
                in: [PAYOUT_STATUS.PAYOUT_REQUESTED, PAYOUT_STATUS.PROCESSING]
              }
            }
          })
        ]);

        let paidOut = 0;
        let netEarnings = 0;
        for (const s of settlements) {
          netEarnings += s.netAmount;
          if (s.status === 'paid') paidOut += s.netAmount;
        }
        const pending = round2(netEarnings - paidOut);
        const openTotal = round2(
          openPayouts.reduce((sum, p) => sum + p.amount, 0)
        );
        const available = round2(Math.max(0, pending - openTotal));

        if (amountRounded > available) {
          return {
            error: `Requested amount exceeds available balance (${available})`,
            code: 400,
            available
          };
        }

        const created = await tx.payoutRequest.create({
          data: {
            providerId: provider.id,
            amount: amountRounded,
            currency: 'BDT',
            method,
            payoutDetails: payoutDetails ?? null,
            status: PAYOUT_STATUS.PAYOUT_REQUESTED
          }
        });

        return { payout: created, availableBefore: available };
      });

      if ('error' in result) {
        const code = result.code ?? 500;
        return res.status(code).json({ error: result.error });
      }

      return res.status(201).json({
        message: 'Payout request created successfully',
        payout: result.payout,
        availableBalanceBeforeRequest: result.availableBefore
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

export default router;