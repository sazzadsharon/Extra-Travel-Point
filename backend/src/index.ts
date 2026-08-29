import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { prisma } from './prisma';

import authRoutes from './routes/auth.routes';
import bookingRoutes from './routes/booking.routes';
import providerRoutes from './routes/provider.routes';
import qrRoutes from './routes/qr.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import webhookRoutes from './routes/webhook.routes';
import uploadRoutes from './routes/upload.routes';
import notificationRoutes from './routes/notification.routes';
import aiRoutes from './routes/ai.routes';
import loyaltyRoutes from './routes/loyalty.routes';
import trackingRoutes from './routes/tracking.routes';
import emergencyRoutes from './routes/emergency.routes';
import reviewRoutes from './routes/review.routes';
import hotelRoutes from './routes/hotel.routes';
import transportRoutes from './routes/transport.routes';
import securityRoutes from './routes/security.routes';
import analyticsRoutes from './routes/analytics.routes';
import discoveryRoutes from './routes/discovery.routes';
import packagesRoutes from './routes/packages.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/v1/auth', authLimiter);

// Health Check endpoints
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Extra Travel Point Backend Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Extra Travel Point Backend API',
    version: '1.0.0',
    description: 'Travel Super App - Backend API Engine',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      bookings: '/api/v1/bookings',
      providers: '/api/v1/providers',
      qr: '/api/v1/qr',
      payments: '/api/v1/payments',
      admin: '/api/v1/admin',
      loyalty: '/api/v1/loyalty',
      reviews: '/api/v1/reviews',
      analytics: '/api/v1/analytics',
      discovery: '/api/v1/discovery',
      transport: '/api/v1/transport',
      hotel: '/api/v1/hotels',
      tracking: '/api/v1/tracking',
      emergency: '/api/v1/emergency',
      ai: '/api/v1/ai',
      notification: '/api/v1/notifications',
      security: '/api/v1/security',
      packages: '/api/v1/packages',
      webhooks: '/api/v1/webhooks',
      upload: '/api/v1/upload'
    }
  });
});

app.get('/health/depth', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      service: 'Extra Travel Point Backend Engine',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        api: 'running'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'Extra Travel Point Backend Engine',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'disconnected',
        api: 'running'
      }
    });
  }
});

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/providers', providerRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/loyalty', loyaltyRoutes);
app.use('/api/v1/tracking', trackingRoutes);
app.use('/api/v1/emergency', emergencyRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/hotels', hotelRoutes);
app.use('/api/v1/transport', transportRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/discovery', discoveryRoutes);
app.use('/api/v1/packages', packagesRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Extra Travel Point Backend Engine running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;
