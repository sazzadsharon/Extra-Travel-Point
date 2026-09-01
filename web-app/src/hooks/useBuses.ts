'use client';

import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import type {
  Bus,
  BusListResponse,
  BusSeatMapResponse
} from '../types/transport';

const api = axios.create({
  baseURL: API_CONFIG.API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT
});

export interface BusSearchParams {
  fromCity?: string;
  toCity?: string;
  date?: string;
}

export function useBuses() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBuses = useCallback(async (params: BusSearchParams = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<BusListResponse>('/transport/buses', { params });
      setBuses(response.data.buses ?? []);
      return response.data.buses;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch buses';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBus = useCallback(async (id: number): Promise<Bus | null> => {
    try {
      const response = await api.get<Bus>(`/transport/buses/${id}`);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch bus';
      setError(message);
      return null;
    }
  }, []);

  const fetchBusSeats = useCallback(async (id: number, date: string): Promise<BusSeatMapResponse | null> => {
    try {
      const response = await api.get<BusSeatMapResponse>(`/transport/buses/${id}/seats`, {
        params: { date }
      });
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch seat map';
      setError(message);
      return null;
    }
  }, []);

  return { buses, isLoading, error, fetchBuses, fetchBus, fetchBusSeats };
}
