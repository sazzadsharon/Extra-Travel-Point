import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { PAYOUT_STATUS, PAYOUT_TRANSITIONS, round2, getVendorBalance, resolveCommissionRate } from '../utils/commission';

const router = Router();

router.use(authenticateJWT, requireRole(['admin']));

// GET /api/v1/admin/payouts
router.get('/payouts', async (req: AuthRequest, res) => {
  try {
    const { status, providerId } = req.query as Record<string, string | undefined>;
    const where: any = {};
    if (status) where.status = status;
    if (providerId) where.providerId = parseInt(providerId, 10);

    const payouts = await prisma.payoutRequest.findMany({
      where,
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            status: true,
            kycStatus: true,
            user: { select: { id: true, fullName: true, phone: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ count: payouts.length, payouts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/admin/payouts/:id
router.get('/payouts/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid payout id' });
    }
    const payout = await prisma.payoutRequest.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            status: true,
            kycStatus: true,
            user: { select: { id: true, fullName: true, phone: true, email: true } }
          }
        }
      }
    });
    if (!payout) return res.status(404).json({ error: 'Payout request not found' });

    let balance;
    let commissionRate;
    try {
      balance = await getVendorBalance(payout.providerId);
      const provider = await prisma.serviceProvider.findUnique({
        where: { id: payout.providerId },
        select: { commissionRate: true }
      });
      commissionRate = provider ? await resolveCommissionRate({ providerRate: provider.commissionRate }) : null;
    } catch {
      balance = null;
      commissionRate = null;
    }

    return res.json({ ...payout, balance, commissionRate });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/admin/payouts/:id/approve
// PAYOUT_REQUESTED -> PROCESSING
const approveSchema = z.object({ transactionRef: z.string().max(200).optional() });
router.patch('/payouts/:id/approve', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid payout id' });
    }
    const parse = approveSchema.safeParse(req.body || {});
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const payout = await prisma.payoutRequest.findUnique({ where: { id } });
    if (!payout) return res.status(404).json({ error: 'Payout request not found' });

    const allowed = PAYOUT_TRANSITIONS[payout.status as keyof typeof PAYOUT_TRANSITIONS] || [];
    if (!allowed.includes(PAYOUT_STATUS.PROCESSING)) {
      return res.status(400).json({
        error: `Invalid status transition: ${payout.status} -> ${PAYOUT_STATUS.PROCESSING}`
      });
    }

    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: {
        status: PAYOUT_STATUS.PROCESSING,
        processedAt: new Date(),
        transactionRef: parse.data.transactionRef ?? payout.transactionRef
      }
    });
    return res.json({ message: 'Payout approved', payout: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/admin/payouts/:id/mark-paid
// PROCESSING -> PAID
const markPaidSchema = z.object({
  transactionRef: z.string().min(1).max(200)
});
router.patch('/payouts/:id/mark-paid', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid payout id' });
    }
    const parse = markPaidSchema.safeParse(req.body || {});
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const result = await prisma.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.findUnique({ where: { id } });
      if (!payout) return { code: 404, error: 'Payout request not found' };

      const allowed = PAYOUT_TRANSITIONS[payout.status as keyof typeof PAYOUT_TRANSITIONS] || [];
      if (!allowed.includes(PAYOUT_STATUS.PAID)) {
        return {
          code: 400,
          error: `Invalid status transition: ${payout.status} -> ${PAYOUT_STATUS.PAID}`
        };
      }

      // Mark the payout as PAID
      const updated = await tx.payoutRequest.update({
        where: { id },
        data: {
          status: PAYOUT_STATUS.PAID,
          paidAt: new Date(),
          transactionRef: parse.data.transactionRef
        }
      });

      // Mark the corresponding settlements (by providerId) whose netAmount
      // is consumed by this payout as PAID. We use the simplest fair
      // allocation: oldest PENDING settlement first.
      let remaining = updated.amount;
      const pendingSettlements = await tx.settlement.findMany({
        where: {
          providerId: payout.providerId,
          status: 'pending'
        },
        orderBy: { createdAt: 'asc' }
      });

      for (const s of pendingSettlements) {
        if (remaining <= 0) break;
        if (s.netAmount <= remaining + 0.005) {
          await tx.settlement.update({
            where: { id: s.id },
            data: {
              status: 'paid',
              paidAt: new Date(),
              settledAt: new Date()
            }
          });
          remaining = round2(remaining - s.netAmount);
        } else {
          // Partial: leave settlement pending (would require ledger splits in
          // a future milestone). Stop here.
          break;
        }
      }

      return { code: 200, payout: updated };
    });

    if (result.code !== 200) {
      return res.status(result.code).json({ error: result.error });
    }
    return res.json({ message: 'Payout marked as paid', payout: result.payout });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/admin/payouts/:id/reject
// PAYOUT_REQUESTED or PROCESSING -> REJECTED (returns funds to available)
const rejectSchema = z.object({
  reason: z.string().min(3).max(500)
});
router.patch('/payouts/:id/reject', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid payout id' });
    }
    const parse = rejectSchema.safeParse(req.body || {});
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const payout = await prisma.payoutRequest.findUnique({ where: { id } });
    if (!payout) return res.status(404).json({ error: 'Payout request not found' });

    const allowed = PAYOUT_TRANSITIONS[payout.status as keyof typeof PAYOUT_TRANSITIONS] || [];
    if (!allowed.includes(PAYOUT_STATUS.REJECTED)) {
      return res.status(400).json({
        error: `Invalid status transition: ${payout.status} -> ${PAYOUT_STATUS.REJECTED}`
      });
    }

    const updated = await prisma.payoutRequest.update({
      where: { id },
      data: {
        status: PAYOUT_STATUS.REJECTED,
        processedAt: new Date(),
        rejectionReason: parse.data.reason
      }
    });
    return res.json({ message: 'Payout rejected', payout: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;