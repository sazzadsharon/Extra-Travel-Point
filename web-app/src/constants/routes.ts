// API_BASE_URL will be provided via the API_CONFIG from the api.ts file
// This file should only be imported after API_CONFIG is set up

import { API_CONFIG } from '../config/api';

const API_BASE_URL = API_CONFIG.API_BASE_URL;

export const apiEndpoints = {
  auth: {
    register: `${API_BASE_URL}/api/v1/auth/register`,
    login: `${API_BASE_URL}/api/v1/auth/login`,
    refreshToken: `${API_BASE_URL}/api/v1/auth/refresh-token`,
    verifyOtp: `${API_BASE_URL}/api/v1/auth/verify-otp`,
  },
  bookings: {
    create: `${API_BASE_URL}/api/v1/bookings`,
    get: `${API_BASE_URL}/api/v1/bookings`,
    getById: (id: number) => `${API_BASE_URL}/api/v1/bookings/${id}`,
    cancel: (id: number) => `${API_BASE_URL}/api/v1/bookings/${id}/cancel`,
    reschedule: (id: number) => `${API_BASE_URL}/api/v1/bookings/${id}/reschedule`,
    seatsMap: `${API_BASE_URL}/api/v1/bookings/seats/map`,
    lockSeats: `${API_BASE_URL}/api/v1/bookings/seats/lock`,
    releaseSeats: `${API_BASE_URL}/api/v1/bookings/seats/release`,
  },
  transport: {
    vehicles: `${API_BASE_URL}/api/v1/transport/vehicles`,
    calculateFare: `${API_BASE_URL}/api/v1/transport/calculate-fare`,
  },
  payments: {
    initiate: `${API_BASE_URL}/api/v1/payments/initiate`,
    verify: `${API_BASE_URL}/api/v1/payments/verify`,
    retry: `${API_BASE_URL}/api/v1/payments/retry`,
    refund: `${API_BASE_URL}/api/v1/payments/refund`,
  },
  qr: {
    generate: (bookingId: number) => `${API_BASE_URL}/api/v1/qr/generate/${bookingId}`,
    verify: `${API_BASE_URL}/api/v1/qr/verify`,
    history: `${API_BASE_URL}/api/v1/qr/history`,
  },
  hotels: {
    search: `${API_BASE_URL}/api/v1/hotels/search`,
    rooms: (id: number) => `${API_BASE_URL}/api/v1/hotels/${id}/rooms`,
  },
  discovery: {
    places: `${API_BASE_URL}/api/v1/discovery/places`,
    routePlanner: `${API_BASE_URL}/api/v1/discovery/route-planner`,
  },
  packages: {
    superBundles: `${API_BASE_URL}/api/v1/packages/super-bundles`,
    oneClickBooking: `${API_BASE_URL}/api/v1/packages/one-click-booking`,
  },
  loyalty: {
    points: `${API_BASE_URL}/api/v1/loyalty/points`,
    history: `${API_BASE_URL}/api/v1/loyalty/history`,
    coupons: `${API_BASE_URL}/api/v1/loyalty/coupons/apply`,
  },
  analytics: {
    overview: `${API_BASE_URL}/api/v1/analytics/overview`,
  },
  admin: {
    dashboard: `${API_BASE_URL}/api/v1/admin/dashboard`,
    bookings: `${API_BASE_URL}/api/v1/admin/bookings`,
    providers: `${API_BASE_URL}/api/v1/admin/providers`,
    revenue: `${API_BASE_URL}/api/v1/admin/revenue`,
  },
};