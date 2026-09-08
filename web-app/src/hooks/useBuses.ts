'use client';

import { useState, useCallback } from 'react';
import api from '../lib/apiClient';
import type {
  Bus,
  BusListResponse,
  BusSeatMapResponse
} from '../types/transport';

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
      const response = await api.get<BusListResponse>('/transport/trips', {
        params: {
          origin: params.fromCity,
          destination: params.toCity,
          date: params.date,
        },
      });

      const trips = response.data.trips ?? [];

      setBuses(trips as unknown as Bus[]);
      return trips as unknown as Bus[];
    } catch (err: any) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to fetch buses';

      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBus = useCallback(async (id: number): Promise<Bus | null> => {
    try {
      const response = await api.get<Bus>(`/transport/trips/${id}`);
      return response.data;
    } catch (err: any) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to fetch bus';

      setError(message);
      return null;
    }
  }, []);

  const fetchBusSeats = useCallback(
    async (id: number, date: string): Promise<BusSeatMapResponse | null> => {
      try {
        const response = await api.get<BusSeatMapResponse>(
          `/transport/trips/${id}/seats`,
          {
            params: { date },
          }
        );

        return response.data;
      } catch (err: any) {
        const message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'Failed to fetch seat map';

        setError(message);
        return null;
      }
    },
    []
  );

  return {
    buses,
    isLoading,
    error,
    fetchBuses,
    fetchBus,
    fetchBusSeats,
  };
}
