import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { generateHmacSignature, verifyHmacSignature, createQRCodeDataURL, QRPayload } from '../utils/qr';

const router = Router();

// GET /api/v1/qr/generate/:bookingId
router.get('/generate/:bookingId', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true, user: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const validFrom = booking.travelDate.toISOString().split('T')[0];
    const validUntilDate = new Date(booking.travelDate);
    validUntilDate.setDate(validUntilDate.getDate() + 5);
    const validUntil = validUntilDate.toISOString().split('T')[0];

    const payload: QRPayload = {
      booking_id: `BKG-${booking.id}`,
      user_id: `USR-${booking.userId}`,
      provider_id: `PRV-${booking.providerId}`,
      category: booking.category,
      valid_from: validFrom,
      valid_until: validUntil,
      discounts: [
        {
          type: 'combo',
          provider: `PRV-${booking.providerId}`,
          value: booking.discountAmount,
          unit: 'BDT'
        }
      ]
    };

    const signature = generateHmacSignature(payload);
    const fullQrObject = {
      payload,
      signature
    };

    const dataUrl = await createQRCodeDataURL(fullQrObject);

    // Save generated QR to booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: { qrCode: dataUrl }
    });

    return res.json({
      bookingId: booking.id,
      qrObject: fullQrObject,
      qrDataUrl: dataUrl
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/qr/verify (Vendor scanner endpoint)
router.post('/verify', authenticateJWT, requireRole(['vendor', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { qrData } = req.body;
    let qrObj = qrData;

    if (typeof qrData === 'string') {
      try {
        qrObj = JSON.parse(qrData);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid QR JSON format' });
      }
    }

    const { payload, signature } = qrObj;

    if (!payload || !signature) {
      return res.status(400).json({ error: 'Missing QR payload or signature' });
    }

    // Verify HMAC-SHA256 signature
    const isValidSignature = verifyHmacSignature(payload, signature);
    if (!isValidSignature) {
      return res.status(400).json({ valid: false, error: 'Invalid QR HMAC signature' });
    }

    const bookingIdNum = parseInt(payload.booking_id.replace('BKG-', ''));
    const userIdNum = parseInt(payload.user_id.replace('USR-', ''));
    const providerIdNum = parseInt(payload.provider_id.replace('PRV-', ''));

    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      include: { user: true }
    });

    if (!booking) {
      return res.status(404).json({ valid: false, error: 'Booking record not found' });
    }

    // Record QR Log
    const qrLog = await prisma.qrLog.create({
      data: {
        bookingId: bookingIdNum,
        userId: userIdNum,
        providerId: providerIdNum,
        qrToken: signature,
        discountType: payload.discounts?.[0]?.type || 'combo',
        discountValue: payload.discounts?.[0]?.value || 0,
        isUsed: true
      }
    });

    return res.json({
      valid: true,
      user_name: booking.user.fullName || booking.user.phone,
      booking_id: payload.booking_id,
      category: payload.category,
      discounts: payload.discounts,
      scanned_at: qrLog.scannedAt
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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

export default router;
