'use client';

import { useState, useCallback } from 'react';
import api from '../lib/apiClient';

export interface TripPlanRequest {
  prompt?: string;
  origin?: string;
  destination?: string;
  durationDays?: number;
  maxBudget?: number;
}

export interface BudgetBreakdown {
  busTicket: number;
  hotelCost: number;
  foodEstimate: number;
  localTransport: number;
  emergencyExtra: number;
  totalCalculated: number;
}

export interface DayItinerary {
  day: number;
  title: string;
  activities: string[];
}

export interface TripPlanResponse {
  query: string;
  destination: string;
  origin: string;
  durationDays: number;
  totalBudget: number;
  budgetBreakdown: BudgetBreakdown;
  dayByDayItinerary: DayItinerary[];
  weatherForecast: {
    condition: string;
    temperatureC: number;
    recommendation: string;
  };
  suggestedBooking: {
    transport: { type: string; fare: number };
    hotel: { name: string; pricePerNight: number };
    recommendedAction: string;
  };
  alternativePlan: {
    title: string;
    totalCost: number;
    savings: number;
    details: string;
  };
  aiMessage: string;
}

export function useTripPlanner() {
  const [plan, setPlan] = useState<TripPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePlan = useCallback(async (request: TripPlanRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post<TripPlanResponse>('/ai/assistant', request);
      setPlan(response.data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to generate trip plan';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { plan, isLoading, error, generatePlan };
}
