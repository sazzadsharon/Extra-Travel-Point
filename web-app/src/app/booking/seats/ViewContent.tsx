'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, MapPin, Users, Shield, Star, CreditCard, Bus as BusIcon, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { API_CONFIG } from '../../../config/api';
import SeatMap, { Seat } from '../../../components/booking/seat-map';
import type { Vehicle } from '../../../types/transport';

interface SeatMapResponse {
  category: string;
  providerId: number;
  date: string;
  totalSeats: number;
  seats: Seat[];
}

export default function SeatingView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const vehicleId = searchParams.get('vehicleId');
  const providerId = searchParams.get('providerId') || '2';
  const travelDate = searchParams.get('travelDate') || '';
  const vehicleType = searchParams.get('vehicleType') || 'bus';
  const fromCity = searchParams.get('fromCity') || '';
  const toCity = searchParams.get('toCity') || '';

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch vehicle and seat map
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [vehiclesRes, seatsRes] = await Promise.all([
          axios.get<Vehicle[]>(`${API_CONFIG.API_BASE_URL}/transport/vehicles`),
          axios.get<SeatMapResponse>(`${API_CONFIG.API_BASE_URL}/bookings/seats/map`, {
            params: { category: vehicleType, providerId, date: travelDate }
          })
        ]);

        const foundVehicle = vehiclesRes.data.find(v => v.id === parseInt(vehicleId || '0'));
        if (!foundVehicle) {
          setError('Vehicle not found');
          return;
        }

        setVehicle(foundVehicle);
        setSeatMap(seatsRes.data);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load seat map');
      } finally {
        setIsLoading(false);
      }
    };

    if (vehicleId) {
      fetchData();
    }
  }, [vehicleId, providerId, travelDate, vehicleType]);

  const handleSelectionChange = useCallback((seats: Seat[], price: number) => {
    setSelectedSeats(seats);
    setTotalPrice(price);
  }, []);

  const handleLockSeats = useCallback(async (seats: Seat[]) => {
    if (seats.length === 0) return;
    setIsLocking(true);
    try {
      const response = await axios.post(`${API_CONFIG.API_BASE_URL}/bookings/seats/lock`, {
        seatNumbers: seats.map(s => s.seatNumber),
        providerId: parseInt(providerId),
        travelDate
      });
      return response.data;
    } catch (err: any) {
      console.error('Seat lock error:', err);
      return null;
    } finally {
      setIsLocking(false);
    }
  }, [providerId, travelDate]);

  const handleContinue = async () => {
    if (selectedSeats.length === 0) {
      alert('Please select at least one seat');
      return;
    }

    const lockResult = await handleLockSeats(selectedSeats);
    const routeQuery = `fromCity=${encodeURIComponent(fromCity)}&toCity=${encodeURIComponent(toCity)}&travelDate=${encodeURIComponent(travelDate)}`;
    router.push(
      `/booking/new?vehicleId=${vehicleId}&providerId=${providerId}&category=${vehicleType}&${routeQuery}&seats=${selectedSeats.map(s => s.seatNumber).join(',')}&totalPrice=${totalPrice}`
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4" />
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="h-64 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !vehicle || !seatMap) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center min-h-[60vh]">
          <Link
            href={`/transport/${vehicleId || '1'}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Vehicle Details
          </Link>
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <BusIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Seat Selection Error</h2>
          <p className="text-gray-600 mb-6">{error || 'Could not load seat map'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/transport/${vehicleId}`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vehicle Details
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Select Your Seats</h2>
                <div className="text-sm text-gray-500">
                  {seatMap.totalSeats} total seats
                </div>
              </div>

              {seatMap.seats.length > 0 ? (
                <SeatMap
                  seats={seatMap.seats}
                  maxSeats={10}
                  onSelectionChange={handleSelectionChange}
                  selectedSeats={selectedSeats}
                  isLoading={isLocking}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No seats available for this route</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2"/></svg>
                    Vehicle
                  </span>
                  <span className="font-medium text-gray-900 capitalize">{vehicleType}</span>
                </div>

                {(fromCity || toCity) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Route
                    </span>
                    <span className="font-medium text-gray-900">
                      {fromCity ? `${fromCity}` : 'Any'} → {toCity ? `${toCity}` : 'Any'}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Date
                  </span>
                  <span className="font-medium text-gray-900">
                    {formatDate(travelDate)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Seats
                  </span>
                  <span className="font-medium text-gray-900">
                    {selectedSeats.length > 0 ? selectedSeats.map(s => s.seatNumber).join(', ') : 'None'}
                  </span>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-blue-700">BDT {totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleContinue}
            disabled={selectedSeats.length === 0 || isLocking}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
          >
            {isLocking ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Locking Seats...
              </>
            ) : (
              <>
                Continue to Details
                <CreditCard className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
