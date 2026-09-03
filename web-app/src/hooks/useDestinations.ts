'use client';

import { useState, useCallback } from 'react';
import api from '../lib/apiClient';

export interface Destination {
  id: number;
  name: string;
  category: string;
  rating: number;
  location: { lat: number; lng: number };
}

export interface DestinationGuide {
  destination: string;
  overview: string;
  bestTimeToVisit: string;
  topAttractions: Destination[];
  nearbyEssentials: {
    restaurants: { name: string; rating: number; distanceKm: number }[];
    hospitals: { name: string; phone: string; distanceKm: number }[];
    atms: { bank: string; distanceKm: number }[];
    fuelStations: { name: string; distanceKm: number }[];
  };
  travelTips: string[];
  currentWeather: {
    tempC: number;
    condition: string;
    humidityPercent: number;
  };
}

export function useDestinations() {
  const [guide, setGuide] = useState<DestinationGuide | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGuide = useCallback(async (destination: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<DestinationGuide>('/discovery/places', {
        params: { destination },
      });
      setGuide(response.data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch destination guide';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { guide, isLoading, error, fetchGuide };
}
