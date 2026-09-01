/**
 * Hook for booking operations
 */
import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import type { Booking, BookingResponse, CreateBookingRequest } from '../types/booking';

const api = axios.create({
  baseURL: API_CONFIG.API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
});

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<Booking[]>('/bookings');
      setBookings(response.data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch bookings';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBooking = useCallback(async (
    data: CreateBookingRequest
  ): Promise<BookingResponse | null> => {
    try {
      const response = await api.post<BookingResponse>('/bookings', data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to create booking';
      setError(message);
      return null;
    }
  }, []);

  const cancelBooking = useCallback(async (id: number): Promise<Booking | null> => {
    try {
      const response = await api.patch<{ message: string; booking: Booking }>(`/bookings/${id}/cancel`);
      return response.data.booking;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to cancel booking';
      setError(message);
      return null;
    }
  }, []);

  const getBooking = useCallback(async (id: number): Promise<Booking | null> => {
    try {
      const response = await api.get<Booking>(`/bookings/${id}`);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch booking';
      setError(message);
      return null;
    }
  }, []);

  return {
    bookings,
    isLoading,
    error,
    fetchUserBookings,
    createBooking,
    cancelBooking,
    getBooking,
  };
}
