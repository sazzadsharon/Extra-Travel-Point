// ============================================
// Extra Travel Point - API Configuration
// ============================================

// Environment-based API URL
const ENV = {
  development: {
    API_BASE_URL: 'http://localhost:5000/api/v1',
    API_URL: 'http://localhost:5000',
  },
  staging: {
    API_BASE_URL: 'https://etp-backend-staging.onrender.com/api/v1',
    API_URL: 'https://etp-backend-staging.onrender.com',
  },
  production: {
    API_BASE_URL: 'https://etp-backend.onrender.com/api/v1',
    API_URL: 'https://etp-backend.onrender.com',
  },
};

// Set current environment
const currentEnv = 'development'; // Change to 'production' for release

export const API_CONFIG = {
  ...ENV[currentEnv as keyof typeof ENV],
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
};

// API Endpoints
export const ENDPOINTS = {
  // Auth
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  REFRESH_TOKEN: '/auth/refresh-token',
  VERIFY_OTP: '/auth/verify-otp',

  // Bookings
  BOOKINGS: '/bookings',
  SEAT_MAP: '/bookings/seats/map',
  LOCK_SEATS: '/bookings/seats/lock',
  RELEASE_SEATS: '/bookings/seats/release',
  RESCHEDULE: (id: number) => `/bookings/${id}/reschedule`,
  CANCEL_BOOKING: (id: number) => `/bookings/${id}/cancel`,
  BOOKING_PDF: (id: number) => `/bookings/${id}/pdf`,

  // Payments
  PAYMENTS: '/payments',
  INITIATE_PAYMENT: '/payments/initiate',
  VERIFY_PAYMENT: '/payments/verify',
  RETRY_PAYMENT: '/payments/retry',
  REFUND_PAYMENT: '/payments/refund',

  // QR
  QR: '/qr',
  VERIFY_QR: '/qr/verify',

  // Hotels
  HOTELS: '/hotels',
  HOTEL_ROOMS: (id: number) => `/hotels/${id}/rooms`,

  // Transport
  TRANSPORT: '/transport',

  // Loyalty
  LOYALTY: '/loyalty',
  LOYALTY_POINTS: '/loyalty/points',

  // Tracking
  TRACKING: '/tracking',
  LIVE_TRACKING: (tripId: string) => `/tracking/live/${tripId}`,

  // Emergency
  EMERGENCY_SOS: '/emergency/sos',

  // Discovery
  DISCOVERY: '/discovery',
  PLACES: '/discovery/places',
  ROUTE_PLANNER: '/discovery/route-planner',

  // Packages
  PACKAGES: '/packages',
  SUPER_BUNDLES: '/packages/super-bundles',
  ONE_CLICK_BOOKING: '/packages/one-click-booking',

  // AI Assistant
  AI_ASSISTANT: '/ai/assistant',

  // Providers
  PROVIDERS: '/providers',
  PROVIDER_VERIFY: (id: number) => `/admin/providers/${id}/verify`,

  // Notifications
  NOTIFICATIONS: '/notifications',
  DISPATCH_NOTIFICATION: '/notifications/dispatch',

  // Reviews
  REVIEWS: '/reviews',

  // Analytics
  ANALYTICS: '/analytics/overview',

  // Upload
  UPLOAD: '/upload',
};

export default API_CONFIG;
