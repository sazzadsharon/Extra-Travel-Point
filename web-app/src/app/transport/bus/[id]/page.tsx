'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bus as BusIcon,
  MapPin,
  Clock,
  Users,
  Shield,
  Star,
  CreditCard,
  Calendar,
  AlertCircle
} from 'lucide-react';
import api from '../../../../lib/apiClient';
import { useAuth } from '../../../../contexts/AuthContext';
import { useBuses } from '../../../../hooks/useBuses';
import SeatMap, { Seat } from '../../../../components/booking/seat-map';
import BookingForm, { PassengerFormData } from '../../../../components/forms/booking-form';
import type { Bus, BusSeatMapResponse } from '../../../../types/transport';

type Step = 'details' | 'seats' | 'passengers' | 'review';

export default function BusDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { fetchBus, fetchBusSeats } = useBuses();

  const busId = parseInt((params?.id as string) ?? '0', 10);
  const initialDate = searchParams?.get('travelDate') ?? '';
  const [travelDate, setTravelDate] = useState(initialDate);
  const [bus, setBus] = useState<Bus | null>(null);
  const [seatMap, setSeatMap] = useState<BusSeatMapResponse | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [passengerData, setPassengerData] = useState<PassengerFormData | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [isLoading, setIsLoading] = useState(true);
  const [isLocking, setIsLocking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setErr = useCallback((msg: string | null) => setError(msg), []);

  useEffect(() => {
    if (!travelDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setTravelDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [travelDate]);

  useEffect(() => {
    if (!busId) return;
    setIsLoading(true);
    setErr(null);
    (async () => {
      const b = await fetchBus(busId);
      if (!b) {
        setErr('Bus not found');
        setIsLoading(false);
        return;
      }
      setBus(b);
      setIsLoading(false);
    })();
  }, [busId, fetchBus, setErr]);

  const loadSeatMap = useCallback(async () => {
    if (!bus || !travelDate) return;
    const sm = await fetchBusSeats(bus.id, travelDate);
    if (!sm) {
      setErr('Failed to load seat map');
      return;
    }
    setSeatMap(sm);
    setSelectedSeats([]);
  }, [bus, travelDate, fetchBusSeats, setErr]);

  const handleSelectionChange = useCallback((seats: Seat[]) => {
    setSelectedSeats(seats);
  }, []);

  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const lockAndContinue = useCallback(async () => {
    if (!bus) return;
    if (selectedSeats.length === 0) {
      setErr('Please select at least one seat');
      return;
    }
    if (!user) {
      router.push(`/login?redirect=/transport/bus/${bus.id}`);
      return;
    }
    setIsLocking(true);
    setErr(null);
    try {
      await api.post(
        `/bookings/seats/lock`,
        {
          seatNumbers: selectedSeats.map(s => s.seatNumber),
          providerId: bus.provider.id,
          category: 'bus',
          travelDate
        }
      );
      setStep('passengers');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to lock seats';
      setErr(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsLocking(false);
    }
  }, [bus, selectedSeats, user, travelDate, router, setErr]);

  const handlePassengerSubmit = useCallback((form: PassengerFormData) => {
    setPassengerData(form);
    setStep('review');
  }, []);

  const handleBookingSubmit = useCallback(
    async (form: PassengerFormData) => {
      if (!bus || !user) return;
      if (selectedSeats.length === 0) {
        setErr('Please select at least one seat');
        return;
      }
      setIsSubmitting(true);
      setErr(null);
      try {
        const payload = {
          providerId: bus.provider.id,
          serviceId: bus.id,
          category: 'bus' as const,
          bookingDate: new Date().toISOString().split('T')[0],
          travelDate,
          numberOfPeople: selectedSeats.length,
          seatNumbers: selectedSeats.map(s => s.seatNumber),
          passengers: form.passengers,
          route: bus.route ?? undefined
        };
        const res = await api.post(`/bookings`, payload);
        const booking = res.data?.booking;
        if (booking?.id) {
          // Server-authoritative final amount (incl. any combo discount) drives payment.
          const finalAmount =
            typeof booking.finalAmount === 'number' ? booking.finalAmount : totalPrice;
          router.push(
            `/booking/payment?bookingId=${booking.id}&totalAmount=${finalAmount}`
          );
        } else {
          setErr('Booking succeeded but no booking id was returned');
        }
      } catch (err: any) {
        const status = err.response?.status;
        const msg = err.response?.data?.error || err.message || 'Failed to create booking';
        const msgStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
        if (status === 409) {
          // Seat inventory changed server-side (already booked / held). Let the
          // user go back and reselect rather than silently failing.
          setErr(`${msgStr}`);
        } else {
          setErr(msgStr);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [bus, user, travelDate, selectedSeats, totalPrice, router, setErr]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading bus details...</div>
      </div>
    );
  }

  if (!bus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BusIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Bus Not Found</h2>
          <Link href="/transport/bus" className="text-blue-600 hover:text-blue-800">
            ← Back to bus listing
          </Link>
        </div>
      </div>
    );
  }

  const nextSlot = bus.availability && bus.availability.length > 0 ? bus.availability[0] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/transport/bus"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Buses
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                <BusIcon className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{bus.name}</h1>
                <p className="text-blue-100 text-lg flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  {bus.provider.businessName}
                  {bus.provider.isVerified && (
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-xs">Verified</span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-200">FARE</p>
              <p className="text-2xl font-bold">BDT {bus.price}</p>
              <p className="text-xs text-blue-200">per seat</p>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-blue-700">
              <MapPin className="w-4 h-4" />
              <p className="text-sm font-medium">Route</p>
            </div>
            <p className="mt-2 font-semibold text-gray-900">{bus.route ?? 'N/A'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-green-700">
              <Clock className="w-4 h-4" />
              <p className="text-sm font-medium">Departure</p>
            </div>
            <p className="mt-2 font-semibold text-gray-900">
              {nextSlot?.startTime ?? 'Scheduled'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-orange-700">
              <Clock className="w-4 h-4" />
              <p className="text-sm font-medium">Arrival</p>
            </div>
            <p className="mt-2 font-semibold text-gray-900">
              {nextSlot?.endTime ?? 'Scheduled'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-purple-700">
              <Users className="w-4 h-4" />
              <p className="text-sm font-medium">Seats</p>
            </div>
            <p className="mt-2 font-semibold text-gray-900">{bus.capacity}</p>
          </div>
        </div>

        {bus.description && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">About this bus</h3>
            <p className="text-gray-700">{bus.description}</p>
          </div>
        )}

        {/* Steps indicator */}
        <div className="mb-6 flex items-center justify-center gap-2 sm:gap-4">
          {(['details', 'seats', 'passengers', 'review'] as Step[]).map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  idx <= ['details', 'seats', 'passengers', 'review'].indexOf(step)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {idx + 1}
              </div>
              <span className="text-sm font-medium hidden sm:inline capitalize">{s}</span>
              {idx < 3 && <div className="w-8 sm:w-12 h-0.5 bg-gray-200" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {String(error)}
          </div>
        )}

        {/* Details step: pick date */}
        {step === 'details' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Travel Date</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Travel Date
                </label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={e => setTravelDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    loadSeatMap();
                    setStep('seats');
                  }}
                  disabled={!travelDate}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium"
                >
                  Continue to Seat Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Seat selection step */}
        {step === 'seats' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Select Seats</h2>
                <div className="text-sm text-gray-500">
                  {seatMap?.totalSeats ?? bus.capacity} seats ·{' '}
                  {seatMap?.availableSeats ?? '...'} available
                </div>
              </div>
              {seatMap ? (
                <SeatMap
                  seats={seatMap.seats as Seat[]}
                  maxSeats={10}
                  onSelectionChange={handleSelectionChange}
                  selectedSeats={selectedSeats}
                  isLoading={isLocking}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">Loading seat map...</div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 lg:sticky lg:top-24 h-fit">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Bus</dt>
                  <dd className="font-medium text-gray-900">{bus.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Date</dt>
                  <dd className="font-medium text-gray-900">{travelDate}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Seats</dt>
                  <dd className="font-medium text-gray-900">
                    {selectedSeats.map(s => s.seatNumber).join(', ') || 'None'}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <dt className="font-semibold text-gray-900">Total</dt>
                  <dd className="font-bold text-blue-700">BDT {totalPrice}</dd>
                </div>
              </dl>
              <button
                onClick={lockAndContinue}
                disabled={selectedSeats.length === 0 || isLocking}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {isLocking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Locking...
                  </>
                ) : (
                  <>
                    Continue to Passenger Info
                    <CreditCard className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Passenger info */}
        {step === 'passengers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <button
                type="button"
                onClick={() => setStep('seats')}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Seats
              </button>
              <BookingForm
                selectedSeats={selectedSeats.map(s => ({ seatNumber: s.seatNumber, price: s.price }))}
                totalPrice={totalPrice}
                onSubmit={handlePassengerSubmit}
                isSubmitting={isSubmitting}
                submitLabel="Review & Continue"
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Review</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Bus</dt>
                  <dd className="font-medium text-gray-900">{bus.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Operator</dt>
                  <dd className="font-medium text-gray-900">{bus.provider.businessName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Route</dt>
                  <dd className="font-medium text-gray-900">{bus.route ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Date</dt>
                  <dd className="font-medium text-gray-900">{travelDate}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Seats</dt>
                  <dd className="font-medium text-gray-900">
                    {selectedSeats.map(s => s.seatNumber).join(', ')}
                  </dd>
                </div>
                <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                  <dt className="font-semibold text-gray-900">Total</dt>
                  <dd className="font-bold text-blue-700">BDT {totalPrice}</dd>
                </div>
                <div className="flex items-center gap-2 text-gray-500 pt-2">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>
                    {bus.provider.rating.toFixed(1)} ({bus.provider.totalReviews} reviews)
                  </span>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Review step: confirm seats/passengers and proceed to payment */}
        {step === 'review' && passengerData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <button
                type="button"
                onClick={() => setStep('passengers')}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-2 text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Passenger Info
              </button>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{String(error)}</span>
                </div>
              )}
              {error && (
                <button
                  type="button"
                  onClick={() => {
                    setErr(null);
                    loadSeatMap();
                    setStep('seats');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  Reselect seats
                </button>
              )}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirm & Pay</h2>
                <p className="text-gray-600 mb-4">
                  Review your journey below, then confirm to lock in your seats and
                  proceed to secure payment. Final pricing (including any combo
                  discounts) is finalized on the payment screen.
                </p>
                <button
                  onClick={() => handleBookingSubmit(passengerData)}
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating booking...
                    </>
                  ) : (
                    <>
                      Confirm & Pay
                      <CreditCard className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Journey</h3>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500">Route</dt>
                    <dd className="font-medium text-gray-900">{bus.route ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Travel Date</dt>
                    <dd className="font-medium text-gray-900">{travelDate}</dd>
                  </div>
                  {nextSlot?.startTime && (
                    <div>
                      <dt className="text-gray-500">Departure</dt>
                      <dd className="font-medium text-gray-900">{nextSlot.startTime}</dd>
                    </div>
                  )}
                  {nextSlot?.endTime && (
                    <div>
                      <dt className="text-gray-500">Arrival</dt>
                      <dd className="font-medium text-gray-900">{nextSlot.endTime}</dd>
                    </div>
                  )}\r\n                </dl>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Seats ({selectedSeats.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedSeats.map(s => (
                    <span
                      key={s.seatNumber}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium"
                    >
                      {s.seatNumber}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Passengers</h3>
                <ul className="space-y-2 text-sm">
                  {passengerData.passengers.map((p, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="text-gray-700">
                        {p.name}
                        {p.seatNumber && <span className="ml-2 text-xs text-gray-500">({p.seatNumber})</span>}
                      </span>
                      <span className="text-gray-500">{p.phone}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Subtotal</dt>
                    <dd className="font-medium text-gray-900">BDT {totalPrice.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                    <span>Estimated Total</span>
                    <span className="text-blue-700">BDT {totalPrice.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500 pt-1">
                    Final total (after any applicable discounts) is shown on the payment screen.
                  </p>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
