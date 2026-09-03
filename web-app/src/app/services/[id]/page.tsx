'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Star,
  CreditCard,
  Package,
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import Image from 'next/image';
import api from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { SERVICE_TYPE_LABELS, type ServiceType } from '@/types/vendor';
import type {
  PublicServiceDetail,
  ServiceBookingResponse
} from '@/types/booking';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const serviceId = parseInt((params?.id as string) ?? '0', 10);

  const [service, setService] = useState<PublicServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [bookingDate, setBookingDate] = useState(
    tomorrow.toISOString().split('T')[0]
  );
  const [quantity, setQuantity] = useState(1);
  const [specialRequest, setSpecialRequest] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  const loadService = useCallback(async () => {
    if (!serviceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<PublicServiceDetail>(
        `/services/${serviceId}`
      );
      setService(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load service');
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    loadService();
  }, [loadService]);

  const submitBooking = useCallback(async () => {
    if (!service) return;
    if (!user) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/services/${service.id}`)}`
      );
      return;
    }
    setIsBooking(true);
    setError(null);
    try {
      const res = await api.post<ServiceBookingResponse>(
        `/services/${service.id}/book`,
        {
          bookingDate,
          quantity,
          specialRequest: specialRequest.trim() || undefined
        }
      );
      const booking = res.data.booking;
      router.push(
        `/booking/payment?bookingId=${booking.id}&totalAmount=${booking.finalAmount}`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create booking');
    } finally {
      setIsBooking(false);
    }
  }, [service, user, bookingDate, quantity, specialRequest, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Service Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'This service is no longer available for booking.'}
          </p>
          <Link
            href="/services"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Services
          </Link>
        </div>
      </div>
    );
  }

  const totalAmount = service.price * quantity;
  const typeLabel =
    SERVICE_TYPE_LABELS[(service.serviceType as ServiceType) || 'OTHER'] ??
    service.serviceType;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/services"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Services
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {service.name}
                </h1>
                <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                  {typeLabel}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
                {service.locationCity && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {service.locationCity}
                  </span>
                )}
                {service.provider?.rating ? (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Star className="w-4 h-4" /> {service.provider.rating.toFixed(1)}
                    {service.provider.totalReviews ? (
                      <span className="text-slate-500">
                        ({service.provider.totalReviews})
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>

              {service.images && service.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {service.images.slice(0, 6).map((img: string, i: number) => (
                    <Image
                      key={i}
                      src={img}
                      alt={service.name}
                      width={300}
                      height={128}
                      className="w-full h-32 object-cover rounded-lg"
                      unoptimized
                    />
                  ))}
                </div>
              )}

              {service.description && (
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                  {service.description}
                </p>
              )}

              {service.route && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                  <strong className="text-slate-900">Route / Location: </strong>
                  {service.route}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Vendor
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 font-bold">
                  {service.provider?.businessName?.[0] ?? 'V'}
                </div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    {service.provider?.businessName}
                    {service.provider?.isVerified ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    {service.provider?.category}
                    {service.provider?.city ? ` · ${service.provider.city}` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Availability
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500 mb-1">Available Days</div>
                  <div className="flex flex-wrap gap-1">
                    {service.availableDays && service.availableDays.length > 0 ? (
                      service.availableDays
                        .slice()
                        .sort((a: number, b: number) => a - b)
                        .map((d: number) => (
                          <span
                            key={d}
                            className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs"
                          >
                            {DAY_LABELS[d]}
                          </span>
                        ))
                    ) : (
                      <span className="text-slate-700">All days</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Service Window</div>
                  <div className="text-slate-700">
                    {service.startDate
                      ? new Date(service.startDate).toLocaleDateString()
                      : '—'}{' '}
                    →{' '}
                    {service.endDate
                      ? new Date(service.endDate).toLocaleDateString()
                      : 'Open'}
                  </div>
                </div>
                {service.capacity != null && (
                  <div>
                    <div className="text-slate-500 mb-1">Max per booking</div>
                    <div className="text-slate-700">{service.capacity}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-24">
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-3xl font-bold text-slate-900">
                  {service.currency ?? 'BDT'} {Number(service.price).toLocaleString()}
                </div>
                <span className="text-xs text-slate-500">per unit</span>
              </div>
              <div className="text-xs text-slate-500 mb-6">
                Server-authoritative price
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Booking Date
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Users className="w-4 h-4 inline mr-1" />
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={service.capacity ?? 50}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        Math.max(1, parseInt(e.target.value || '1', 10))
                      )
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {service.capacity != null && (
                    <p className="text-xs text-slate-500 mt-1">
                      Max {service.capacity} per booking
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Special Request (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={specialRequest}
                    onChange={(e) => setSpecialRequest(e.target.value)}
                    maxLength={500}
                    placeholder="Any dietary, accessibility, or timing requests…"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 mt-5 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {service.currency ?? 'BDT'} {Number(service.price).toLocaleString()} ×{' '}
                    {quantity}
                  </span>
                  <span className="text-slate-700">
                    {(service.price * quantity).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between font-bold text-lg border-t border-slate-100 pt-2">
                  <span>Total</span>
                  <span className="text-blue-700">
                    {service.currency ?? 'BDT'} {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={submitBooking}
                disabled={isBooking || !user}
                className="mt-5 w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-300 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {isBooking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Booking…
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Book Service
                  </>
                )}
              </button>

              {!user && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  You&apos;ll be asked to sign in to continue
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}