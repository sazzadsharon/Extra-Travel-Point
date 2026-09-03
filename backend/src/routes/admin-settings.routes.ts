import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { z } from 'zod';
import { resolveCommissionRate, DEFAULT_COMMISSION_RATE, SYSTEM_SETTING_KEY } from '../utils/commission';

const router = Router();

router.use(authenticateJWT, requireRole(['admin']));

const commissionPatchSchema = z.object({
  defaultRate: z.coerce
    .number()
    .refine((v) => Number.isFinite(v), 'defaultRate must be a finite number')
    .refine((v) => v >= 0, 'defaultRate must be >= 0')
    .refine((v) => v <= 100, 'defaultRate must be <= 100')
});

// GET /api/v1/admin/settings/commission
router.get('/commission', async (req: AuthRequest, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SYSTEM_SETTING_KEY }
    });

    let defaultRate = DEFAULT_COMMISSION_RATE;
    if (setting && setting.value.trim() !== '') {
      const parsed = parseFloat(setting.value);
      if (Number.isFinite(parsed)) {
        defaultRate = Math.max(0, Math.min(100, parsed));
      }
    }

    return res.json({ defaultRate });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/v1/admin/settings/commission
router.patch('/commission', async (req: AuthRequest, res) => {
  try {
    const parse = commissionPatchSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.issues });
    }

    const newRate = parse.data.defaultRate;
    const oldSetting = await prisma.systemSetting.findUnique({
      where: { key: SYSTEM_SETTING_KEY }
    });

    const oldRate = oldSetting ? parseFloat(oldSetting.value) : DEFAULT_COMMISSION_RATE;
    if (!Number.isFinite(oldRate)) {
      // treat as default if stored value is corrupt
    }

    const upserted = await prisma.systemSetting.upsert({
      where: { key: SYSTEM_SETTING_KEY },
      update: { value: String(newRate) },
      create: { key: SYSTEM_SETTING_KEY, value: String(newRate) }
    });

    // Audit trail
    await prisma.auditLog.create({
      data: {
        action: 'COMMISSION_RATE_CHANGED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        details: `Commission rate changed from ${oldRate}% to ${newRate}%`,
        metadata: JSON.stringify({ oldRate, newRate })
      }
    });

    return res.json({ defaultRate: newRate, message: 'Commission rate updated' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
