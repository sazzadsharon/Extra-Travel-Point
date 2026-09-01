/**
 * Hook for fetching transport/vehicle data from the backend API
 */
import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import type { Vehicle, CalculateFareRequest, CalculateFareResponse } from '../types/transport';

const api = axios.create({
  baseURL: API_CONFIG.API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
});

export function useTransports() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async (category?: string, city?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (category) params.category = category;
      if (city) params.city = city;

      const response = await api.get<Vehicle[]>('/transport/vehicles', { params });
      setVehicles(response.data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch vehicles';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const calculateFare = useCallback(async (
    vehicleType: string,
    distanceKm: number,
    isAirportTransfer = false
  ): Promise<CalculateFareResponse | null> => {
    try {
      const body: CalculateFareRequest = { vehicleType, distanceKm, isAirportTransfer };
      const response = await api.post<CalculateFareResponse>('/transport/calculate-fare', body);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to calculate fare';
      setError(message);
      return null;
    }
  }, []);

  return {
    vehicles,
    isLoading,
    error,
    fetchVehicles,
    calculateFare,
  };
}
