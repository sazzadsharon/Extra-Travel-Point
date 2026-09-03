// API_BASE_URL will be provided via the API_CONFIG from the api.ts file.
// NOTE: API_BASE_URL already includes /api/v1, so do NOT prepend /api/v1 here.
// This file should only be imported after API_CONFIG is set up.

import { API_CONFIG } from '../config/api';

const API_BASE_URL = API_CONFIG.API_BASE_URL;

export const apiEndpoints = {
  auth: {
    register: `${API_BASE_URL}/auth/register`,
    login: `${API_BASE_URL}/auth/login`,
    refreshToken: `${API_BASE_URL}/auth/refresh-token`,
    verifyOtp: `${API_BASE_URL}/auth/verify-otp`,
  },
  bookings: {
    create: `${API_BASE_URL}/bookings`,
    get: `${API_BASE_URL}/bookings`,
    getById: (id: number) => `${API_BASE_URL}/bookings/${id}`,
    cancel: (id: number) => `${API_BASE_URL}/bookings/${id}/cancel`,
    reschedule: (id: number) => `${API_BASE_URL}/bookings/${id}/reschedule`,
    seatsMap: `${API_BASE_URL}/bookings/seats/map`,
    lockSeats: `${API_BASE_URL}/bookings/seats/lock`,
    releaseSeats: `${API_BASE_URL}/bookings/seats/release`,
  },
  transport: {
    vehicles: `${API_BASE_URL}/transport/vehicles`,
    buses: `${API_BASE_URL}/transport/buses`,
    busById: (id: number) => `${API_BASE_URL}/transport/buses/${id}`,
    calculateFare: `${API_BASE_URL}/transport/calculate-fare`,
  },
  payments: {
    initiate: `${API_BASE_URL}/payments/initiate`,
    verify: `${API_BASE_URL}/payments/verify`,
    retry: `${API_BASE_URL}/payments/retry`,
    refund: `${API_BASE_URL}/payments/refund`,
  },
  qr: {
    generate: (bookingId: number) => `${API_BASE_URL}/qr/generate/${bookingId}`,
    verify: `${API_BASE_URL}/qr/verify`,
    history: `${API_BASE_URL}/qr/history`,
  },
  travelPasses: {
    issue: `${API_BASE_URL}/travel-passes`,
    byCode: (code: string) => `${API_BASE_URL}/travel-passes/${code}`,
    verify: `${API_BASE_URL}/travel-passes/verify`,
  },
  hotels: {
    search: `${API_BASE_URL}/hotels/search`,
    rooms: (id: number) => `${API_BASE_URL}/hotels/${id}/rooms`,
  },
  discovery: {
    places: `${API_BASE_URL}/discovery/places`,
    routePlanner: `${API_BASE_URL}/discovery/route-planner`,
  },
  packages: {
    superBundles: `${API_BASE_URL}/packages/super-bundles`,
    oneClickBooking: `${API_BASE_URL}/packages/one-click-booking`,
  },
  loyalty: {
    points: `${API_BASE_URL}/loyalty/points`,
    history: `${API_BASE_URL}/loyalty/history`,
    coupons: `${API_BASE_URL}/loyalty/coupons/apply`,
  },
  analytics: {
    overview: `${API_BASE_URL}/analytics/overview`,
  },
  admin: {
    dashboard: `${API_BASE_URL}/admin/dashboard`,
    bookings: `${API_BASE_URL}/admin/bookings`,
    providers: `${API_BASE_URL}/admin/providers`,
    revenue: `${API_BASE_URL}/admin/revenue`,
  },
};
