import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import {
  generateHmacSignature,
  verifyHmacSignature,
  createQRCodeDataURL,
  generateTravelPassToken,
  TravelPassPayload
} from '../utils/qr';

const router = Router();

// Build the Travel Pass payload (only non-PII fields)
function buildTravelPassPayload(args: {
  token: string;
  bookingCode: string;
  providerId: number;
  category: string;
  travelDate: Date;
  discountAmount: number;
}): TravelPassPayload {
  const validFrom = args.travelDate.toISOString().split('T')[0];
  const validUntilDate = new Date(args.travelDate);
  validUntilDate.setDate(validUntilDate.getDate() + 5);
  const validUntil = validUntilDate.toISOString().split('T')[0];
  return {
    tp: args.token,
    bkg: args.bookingCode,
    prv: args.providerId,
    category: args.category,
    valid_from: validFrom,
    valid_until: validUntil,
    discounts: [
      {
        type: 'combo',
        provider: `PRV-${args.providerId}`,
        value: args.discountAmount,
        unit: 'BDT'
      }
    ]
  };
}

async function generateTravelPass(bookingId: number, userId: number, userRole: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { provider: true, user: true }
  });
  if (!booking) return { status: 404, body: { error: 'Booking not found' } };

  if (booking.userId !== userId && userRole !== 'admin') {
    return { status: 403, body: { error: 'Access denied' } };
  }

  if (booking.status === 'cancelled') {
    return { status: 400, body: { error: 'Cannot generate travel pass for cancelled booking' } };
  }

  // Generate or reuse token
  let token = booking.qrToken || generateTravelPassToken();

  // Calculate expiry
  const validFrom = booking.travelDate.toISOString().split('T')[0];
  const validUntilDate = new Date(booking.travelDate);
  validUntilDate.setDate(validUntilDate.getDate() + 5);
  const validUntil = validUntilDate.toISOString().split('T')[0];

  const payload = buildTravelPassPayload({
    token,
    bookingCode: booking.bookingCode,
    providerId: booking.providerId,
    category: booking.category,
    travelDate: booking.travelDate,
    discountAmount: booking.discountAmount
  });

  const signature = generateHmacSignature(payload);
  const fullQrObject = { payload, signature };
  const dataUrl = await createQRCodeDataURL(fullQrObject);

  // Persist token + qr data url
  await prisma.booking.update({
    where: { id: bookingId },
    data: { qrToken: token, qrCode: dataUrl }
  });

  return {
    status: 200,
    body: {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      travelPass: {
        token,
        status: booking.status,
        validFrom,
        validUntil,
        category: booking.category,
        provider: {
          id: booking.provider.id,
          businessName: booking.provider.businessName
        },
        qrObject: fullQrObject,
        qrDataUrl: dataUrl
      }
    }
  };
}

// =====================================================================
// BACKWARDS-COMPATIBLE QR ENDPOINTS (used by existing Web + Flutter)
// =====================================================================

// GET /api/v1/qr/generate/:bookingId
router.get('/generate/:bookingId', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }
    const result = await generateTravelPass(bookingId, req.user!.id, req.user!.role);
    if (result.status !== 200) return res.status(result.status).json(result.body);

    // Shape backward-compatible with existing web/mobile clients
    const tp = result.body.travelPass!;
    return res.json({
      bookingId: result.body.bookingId,
      qrObject: tp.qrObject,
      qrDataUrl: tp.qrDataUrl
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/qr/verify (Vendor scanner endpoint)
router.post('/verify', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const raw = req.body.qrData ?? req.body.qrToken;
    if (!raw) return res.status(400).json({ valid: false, error: 'Missing QR data' });

    let qrObj = raw;
    if (typeof raw === 'string') {
      try { qrObj = JSON.parse(raw); }
      catch { return res.status(400).json({ valid: false, error: 'Invalid QR JSON format' }); }
    }

    const payload = qrObj?.payload;
    const signature = qrObj?.signature;
    if (!payload || !signature) return res.status(400).json({ valid: false, error: 'Missing QR payload or signature' });

    if (!verifyHmacSignature(payload, signature)) {
      return res.status(400).json({ valid: false, error: 'Invalid QR HMAC signature' });
    }

    const token: string = payload.tp;
    const bookingCode: string = payload.bkg;
    const providerIdInQr: number = payload.prv;

    const booking = await prisma.booking.findFirst({
      where: { bookingCode, qrToken: token },
      include: { user: { select: { id: true, fullName: true, phone: true } }, provider: true }
    });

    if (!booking) {
      return res.status(404).json({ valid: false, error: 'Travel pass not found' });
    }

    // Vendor ownership check: vendor scanning must own this provider
    if (req.user!.role === 'vendor') {
      const owned = await prisma.serviceProvider.findFirst({
        where: { id: booking.providerId, userId: req.user!.id }
      });
      if (!owned) {
        return res.status(403).json({ valid: false, error: 'You can only verify passes for your own business' });
      }
    }

    // Booking status check
    if (booking.status === 'cancelled') {
      return res.status(400).json({ valid: false, error: 'Travel pass is cancelled', status: booking.status });
    }

    // Expiry check
    const validUntilDate = new Date(booking.travelDate);
    validUntilDate.setDate(validUntilDate.getDate() + 5);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today > validUntilDate) {
      return res.status(400).json({ valid: false, error: 'Travel pass expired', status: booking.status });
    }

    // Replay protection: same qrToken was already verified today?
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyScanned = await prisma.qrLog.findFirst({
      where: {
        bookingId: booking.id,
        qrToken: signature,
        scannedAt: { gte: todayStart }
      }
    });
    if (alreadyScanned) {
      return res.status(409).json({
        valid: false,
        error: 'Travel pass already verified today (replay protection)',
        firstScannedAt: alreadyScanned.scannedAt
      });
    }

    // Verify providerId in qr matches DB (defense in depth)
    if (providerIdInQr && providerIdInQr !== booking.providerId) {
      return res.status(400).json({ valid: false, error: 'Provider mismatch' });
    }

    const qrLog = await prisma.qrLog.create({
      data: {
        bookingId: booking.id,
        userId: booking.userId,
        providerId: booking.providerId,
        qrToken: signature,
        discountType: payload.discounts?.[0]?.type || 'combo',
        discountValue: payload.discounts?.[0]?.value || 0,
        isUsed: true
      }
    });

    return res.json({
      valid: true,
      bookingCode: booking.bookingCode,
      user_name: booking.user.fullName || booking.user.phone,
      category: booking.category,
      discounts: payload.discounts,
      validFrom: payload.valid_from,
      validUntil: payload.valid_until,
      scannedAt: qrLog.scannedAt
    });
  } catch (error: any) {
    return res.status(500).json({ valid: false, error: error.message });
  }
});

// GET /api/v1/qr/history
router.get('/history', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const logs = await prisma.qrLog.findMany({
      where: req.user!.role === 'admin' ? {} : { userId: req.user!.id },
      include: { booking: true, provider: true },
      orderBy: { scannedAt: 'desc' }
    });
    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// SHARED TRAVEL PASS API (consumed by Web + Mobile)
// =====================================================================

// POST /api/v1/travel-passes - issue a travel pass for a booking (customer or admin)
router.post('/', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const schema = require('zod').z.object({
      bookingId: (require('zod').z as any).number().int().positive()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

    const result = await generateTravelPass(parsed.data.bookingId, req.user!.id, req.user!.role);
    return res.status(result.status).json(result.body);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/travel-passes/:bookingCode - retrieve travel pass (customer or admin)
router.get('/:bookingCode', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingCode = String(req.params.bookingCode);
    const booking = await prisma.booking.findUnique({
      where: { bookingCode },
      include: { provider: true, user: true, flight: true }
    });
    if (!booking) return res.status(404).json({ error: 'Travel pass not found' });

    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const validFrom = booking.travelDate.toISOString().split('T')[0];
    const validUntilDate = new Date(booking.travelDate);
    validUntilDate.setDate(validUntilDate.getDate() + 5);
    const validUntil = validUntilDate.toISOString().split('T')[0];

    let status = booking.status;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (booking.status === 'cancelled') status = 'cancelled';
    else if (today > validUntilDate) status = 'expired';

    return res.json({
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      status,
      validFrom,
      validUntil,
      category: booking.category,
      provider: { id: booking.provider.id, businessName: booking.provider.businessName },
      qrToken: booking.qrToken || null,
      qrCode: booking.qrCode || null
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;