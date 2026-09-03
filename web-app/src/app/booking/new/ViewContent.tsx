'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bus, MapPin, Users, CreditCard } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/apiClient';
import BookingForm, { PassengerFormData } from '../../../components/forms/booking-form';

export default function BookingNewView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const vehicleId = searchParams.get('vehicleId') || '';
  const providerId = searchParams.get('providerId') || '2';
  const travelDate = searchParams.get('travelDate') || '';
  const seatsParam = searchParams.get('seats') || '';
  const totalPriceParam = searchParams.get('totalPrice') || '0';
  const vehicleType = searchParams.get('category') || searchParams.get('vehicleType') || 'bus';
  const fromCity = searchParams.get('fromCity') || '';
  const toCity = searchParams.get('toCity') || '';

  const selectedSeats: string[] = useMemo(() => seatsParam ? seatsParam.split(',') : [], [seatsParam]);
  const totalPrice = parseFloat(totalPriceParam);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBookingSubmit = useCallback(async (formData: PassengerFormData) => {
    if (!user) {
      setError('Please login to continue');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const route = fromCity && toCity ? `${fromCity} → ${toCity}` : undefined;

      const bookingPayload = {
        providerId: parseInt(providerId),
        category: vehicleType,
        bookingDate: new Date().toISOString().split('T')[0],
        travelDate: travelDate,
        numberOfPeople: formData.passengers.length,
        seatNumbers: selectedSeats,
        passengers: formData.passengers,
        route,
        totalAmount: totalPrice
      };

      const response = await api.post(
        `/bookings`,
        bookingPayload
      );

      const result = response.data;
      const bookingId = result.booking?.id;
      if (bookingId) {
        const finalAmount = result.booking?.finalAmount ?? totalPrice;
        const routeQuery = `fromCity=${encodeURIComponent(fromCity)}&toCity=${encodeURIComponent(toCity)}&travelDate=${encodeURIComponent(travelDate)}`;
        router.push(`/booking/payment?bookingId=${bookingId}&totalAmount=${finalAmount}&vehicleId=${vehicleId}&providerId=${providerId}&category=${vehicleType}&${routeQuery}&seats=${seatsParam}&totalPrice=${finalAmount}`);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message
        || err.response?.data?.error
        || 'Failed to create booking';
      setError(Array.isArray(errorMsg) ? JSON.stringify(errorMsg) : errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }, [user, providerId, vehicleType, travelDate, totalPrice, router, vehicleId, seatsParam, fromCity, toCity, selectedSeats]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/booking/seats?vehicleId=${vehicleId}&providerId=${providerId}&category=${vehicleType}&fromCity=${encodeURIComponent(fromCity)}&toCity=${encodeURIComponent(toCity)}&travelDate=${travelDate}`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Seat Selection
        </Link>

        <div className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
          {['Vehicle', 'Seats', 'Details', 'Payment', 'Confirm'].map((step, index) => (
            <React.Fragment key={step}>
              <div className={`flex items-center gap-2 ${index <= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {index + 1}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{step}</span>
              </div>
              {index < 4 && (
                <div className={`w-8 sm:w-12 h-0.5 ${index < 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Bus className="w-4 h-4" />
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
                    {travelDate ? new Date(travelDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Passengers
                  </span>
                  <span className="font-medium text-gray-900">{selectedSeats.length || 1}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Seats
                  </span>
                  <span className="font-medium text-gray-900">{selectedSeats.join(', ') || 'None'}</span>
                </div>

                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-blue-700">BDT {totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Passenger Information</h2>
              <p className="text-gray-600 mb-6">Enter passenger details for your journey</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <BookingForm
                selectedSeats={selectedSeats.map((seatNumber: string) => ({ seatNumber, price: 0 }))}
                totalPrice={totalPrice}
                onSubmit={handleBookingSubmit}
                isSubmitting={isSubmitting}
                submitLabel="Proceed to Payment"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
