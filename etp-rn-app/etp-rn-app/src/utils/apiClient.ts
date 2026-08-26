// ============================================
// Extra Travel Point - API Client
// ============================================

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './api';

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.API_BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAuthToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            this.clearAuth();
            // Navigate to login - implement based on your navigation
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    // Implement based on your storage solution (AsyncStorage, SecureStore, etc.)
    return null;
  }

  private setAuthToken(token: string) {
    // Implement token storage
  }

  private getRefreshToken(): string | null {
    // Implement based on your storage solution
    return null;
  }

  private setRefreshToken(token: string) {
    // Implement refresh token storage
  }

  private clearAuth() {
    // Clear stored tokens
  }

  private async refreshToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${API_CONFIG.API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        this.setAuthToken(accessToken);
        this.setRefreshToken(newRefreshToken);

        return accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Auth methods
  async login(phone: string, password: string) {
    const response = await this.client.post('/auth/login', { phone, password });
    if (response.data.tokens) {
      this.setAuthToken(response.data.tokens.accessToken);
      this.setRefreshToken(response.data.tokens.refreshToken);
    }
    return response.data;
  }

  async register(data: { phone: string; password: string; fullName?: string; email?: string }) {
    const response = await this.client.post('/auth/register', data);
    if (response.data.tokens) {
      this.setAuthToken(response.data.tokens.accessToken);
      this.setRefreshToken(response.data.tokens.refreshToken);
    }
    return response.data;
  }

  async verifyOtp(phone: string, otp: string) {
    const response = await this.client.post('/auth/verify-otp', { phone, otp });
    return response.data;
  }

  // Booking methods
  async getBookings() {
    const response = await this.client.get('/bookings');
    return response.data;
  }

  async createBooking(data: {
    providerId: number;
    category: string;
    bookingDate: string;
    travelDate: string;
    numberOfPeople: number;
    totalAmount: number;
  }) {
    const response = await this.client.post('/bookings', data);
    return response.data;
  }

  async cancelBooking(bookingId: number) {
    const response = await this.client.patch(`/bookings/${bookingId}/cancel`);
    return response.data;
  }

  async getSeatMap(category: string, providerId: number, date: string) {
    const response = await this.client.get('/bookings/seats/map', {
      params: { category, providerId, date },
    });
    return response.data;
  }

  // Payment methods
  async initiatePayment(bookingId: number, method: string, amount: number) {
    const response = await this.client.post('/payments/initiate', {
      bookingId,
      method,
      amount,
    });
    return response.data;
  }

  async verifyPayment(transactionId: string) {
    const response = await this.client.post('/payments/verify', { transactionId });
    return response.data;
  }

  // QR methods
  async verifyQr(qrToken: string) {
    const response = await this.client.post('/qr/verify', { qrToken });
    return response.data;
  }

  // Hotels
  async getHotels(params?: { city?: string; category?: string }) {
    const response = await this.client.get('/hotels', { params });
    return response.data;
  }

  // Tracking
  async getLiveTracking(tripId: string) {
    const response = await this.client.get(`/tracking/live/${tripId}`);
    return response.data;
  }

  // Emergency
  async sendSOS(location: { latitude: number; longitude: number; tripId?: string }) {
    const response = await this.client.post('/emergency/sos', location);
    return response.data;
  }

  // Discovery
  async getNearbyPlaces(lat: number, lng: number, type?: string) {
    const response = await this.client.get('/discovery/places', {
      params: { lat, lng, type },
    });
    return response.data;
  }

  // Packages
  async getSuperBundles() {
    const response = await this.client.get('/packages/super-bundles');
    return response.data;
  }

  async oneClickBooking(packageId: string) {
    const response = await this.client.post('/packages/one-click-booking', { packageId });
    return response.data;
  }

  // Generic request method
  async request(method: string, url: string, data?: any) {
    const response = await this.client.request({ method, url, data });
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
