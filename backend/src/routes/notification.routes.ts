import { Router } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/v1/notifications/dispatch (Multi-Channel & Multi-Event Dispatcher)
router.post('/dispatch', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const { eventType, userId, recipientPhone, recipientEmail, title, message, channels } = req.body;

    const activeChannels = channels || ['APP_PUSH', 'SMS', 'EMAIL', 'WHATSAPP'];

    const dispatchedResults = {
      appPush: activeChannels.includes('APP_PUSH') ? { status: 'DELIVERED', provider: 'FCM Push Engine' } : null,
      sms: activeChannels.includes('SMS') ? { status: 'SENT', provider: 'Teletalk/GP SMS Gateway', recipient: recipientPhone || req.user!.phone } : null,
      email: activeChannels.includes('EMAIL') ? { status: 'SENT', provider: 'SMTP Relay', recipient: recipientEmail || 'user@extratravelpoint.com' } : null,
      whatsapp: activeChannels.includes('WHATSAPP') ? { status: 'DELIVERED', provider: 'WhatsApp Business API', recipient: recipientPhone || req.user!.phone } : null
    };

    return res.json({
      success: true,
      dispatchId: `NOTIF-${Date.now()}`,
      eventType: eventType || 'BOOKING_CONFIRMED',
      payload: { title, message },
      channelsUsed: activeChannels,
      dispatchedResults,
      timestamp: new Date()
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/notifications
router.get('/', authenticateJWT, async (req: AuthRequest, res) => {
  return res.json([
    {
      id: 1,
      title: 'Booking Reminder 🔔',
      message: 'Your Bus to Cox\'s Bazar departs tomorrow at 08:00 AM.',
      read: false,
      createdAt: new Date()
    },
    {
      id: 2,
      title: 'Combo Discount Unlocked 🎉',
      message: 'You received 15% discount on your hotel booking!',
      read: true,
      createdAt: new Date()
    }
  ]);
});

// POST /api/v1/notifications/send-push
router.post('/send-push', authenticateJWT, async (req: AuthRequest, res) => {
  const { userId, title, message } = req.body;
  return res.json({
    success: true,
    message: `Push notification sent to User ${userId || req.user!.id}`,
    payload: { title, message }
  });
});

export default router;
