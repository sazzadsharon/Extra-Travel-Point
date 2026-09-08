'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, MapPin, Star, Wifi, Coffee, Car, Users, Check, X, Phone, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/apiClient';
import { useAuth } from '../../../contexts/AuthContext';

interface HotelRoom {
  id: number;
  name: string;
  type: string;
  description?: string | null;
  price: number;
  currency: string;
  capacity: number;
  adultCapacity?: number;
  childCapacity?: number;
  bedConfig?: string | null;
  totalRooms: number;
  amenities?: string | null;
  images?: string | null;
  isAvailable: boolean;
  ratePlans: Array<{ id: number; name: string; price: number; mealPlan: string; refundable: boolean; minStay: number; maxStay?: number | null }>;
}

interface HotelDetail {
  id: number;
  slug?: string | null;
  businessName: string;
  description?: string | null;
  address: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  starRating?: number | null;
  rating: number;
  totalReviews: number;
  phone?: string | null;
  images: Array<{ url: string; caption?: string | null; isPrimary: boolean }>;
  amenities: string[];
  policy?: { cancellationPolicy?: string | null; checkInTime?: string; checkOutTime?: string; childPolicy?: string | null; petPolicy?: string | null; smokingPolicy?: string | null } | null;
  rooms: HotelRoom[];
  reviews: Array<{ id: number; rating: number; comment?: string | null; reviewer: string; createdAt: string }>;
}

interface PriceQuote {
  baseAmount: number;
  nights: number;
  nightlyRate: number;
  taxAmount: number;
  serviceFee: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  lines: Array<{ label: string; amount: number }>;
}

function amenityIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('wifi')) return <Wifi className="w-3.5 h-3.5" />;
  if (n.includes('parking') || n.includes('car')) return <Car className="w-3.5 h-3.5" />;
  if (n.includes('breakfast') || n.includes('restaurant') || n.includes('coffee')) return <Coffee className="w-3.5 h-3.5" />;
  return <Check className="w-3.5 h-3.5" />;
}

export default function HotelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const isAuthenticated = !!user && !!accessToken;
  const id = params?.id as string;

  const [hotel, setHotel] = useState<HotelDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<HotelRoom | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [promoCode, setPromoCode] = useState('');
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ bookingId: number; bookingCode: string; finalAmount: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await api.get<HotelDetail>(`/hotels/details/${id}`);
        setHotel(res.data);
        if (res.data.rooms[0]) setSelectedRoom(res.data.rooms[0]);
        const today = new Date();
        const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
        const after = new Date(); after.setDate(today.getDate() + 3);
        setCheckIn(tomorrow.toISOString().split('T')[0]);
        setCheckOut(after.toISOString().split('T')[0]);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load hotel');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (user) setCustomer(c => ({ ...c, name: c.name || user.fullName || '', phone: c.phone || user.phone || '' }));
  }, [user]);

  const requestQuote = useCallback(async () => {
    if (!selectedRoom || !checkIn || !checkOut) return;
    setQuoteLoading(true);
    setQuote(null);
    try {
      const res = await api.post<{ nights: number; breakdown: PriceQuote }>('/hotels/quote', {
        roomId: selectedRoom.id,
        checkIn, checkOut,
        promoCode: promoCode || undefined
      });
      setQuote(res.data.breakdown);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get price');
    } finally {
      setQuoteLoading(false);
    }
  }, [selectedRoom, checkIn, checkOut, promoCode]);

  useEffect(() => { if (selectedRoom) requestQuote(); }, [selectedRoom?.id, checkIn, checkOut, promoCode]);

  const handleBook = async () => {
    if (!selectedRoom || !quote) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=/hotels/${id}`);
      return;
    }
    if (!customer.name || !customer.email || !customer.phone) {
      setError('Please complete guest information');
      return;
    }
    setBookingLoading(true);
    setError(null);
    try {
      const res = await api.post<{ booking: { id: number; bookingCode: string; finalAmount: number } }>('/hotels/book', {
        hotelId: Number(id),
        roomId: selectedRoom.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfGuests: guests,
        customerInfo: customer,
        promoCode: promoCode || undefined
      });
      setBookingResult({ bookingId: res.data.booking.id, bookingCode: res.data.booking.bookingCode, finalAmount: res.data.booking.finalAmount });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!bookingResult) return;
    setBookingLoading(true);
    setError(null);
    try {
      const res = await api.post<{ payment: { id: number; checkoutUrl?: string; gateway: string } }>('/payments/initiate', {
        bookingId: bookingResult.bookingId,
        method: 'sslcommerz'
      });
      const checkoutUrl = (res.data as any).payment?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        router.push(`/hotels/bookings/${bookingResult.bookingId}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setBookingLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-etp-600" /></div>;
  }
  if (error && !hotel) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }
  if (!hotel) return null;

  if (bookingResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking created!</h2>
          <p className="text-slate-500 mb-4">Complete payment to confirm your reservation.</p>
          <div className="bg-slate-50 rounded-xl p-4 text-left text-sm mb-4">
            <p><span className="text-slate-500">Code:</span> <strong>{bookingResult.bookingCode}</strong></p>
            <p><span className="text-slate-500">Total:</span> <strong>BDT {bookingResult.finalAmount.toLocaleString()}</strong></p>
          </div>
          <button
            onClick={handlePayNow}
            disabled={bookingLoading}
            className="block w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-2.5 rounded-xl font-semibold hover:opacity-90 mb-2"
          >
            {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Pay now'}
          </button>
          <Link href={`/hotels/bookings/${bookingResult.bookingId}`} className="block w-full border border-etp-300 text-etp-700 py-2.5 rounded-xl font-semibold hover:bg-etp-50 mb-2">View e-ticket</Link>
          <Link href="/hotels" className="block w-full text-etp-600 py-2 text-sm">Browse more hotels</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {hotel.images[0] ? (
            <div className="aspect-[4/3] md:col-span-2 md:aspect-[2/1] rounded-2xl overflow-hidden bg-slate-100">
              <img src={hotel.images[0].url} alt={hotel.businessName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-[4/3] md:col-span-2 md:aspect-[2/1] rounded-2xl bg-gradient-to-br from-etp-100 to-violet-100 flex items-center justify-center text-etp-300">
              <span className="text-sm">No image</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6 mb-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-1">{hotel.businessName}</h1>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {hotel.address} {hotel.city ? `, ${hotel.city}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  {hotel.starRating ? (
                    <div className="flex gap-0.5 justify-end mb-1">
                      {Array.from({ length: hotel.starRating }).map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                    </div>
                  ) : null}
                  {hotel.rating > 0 ? (
                    <div className="text-sm font-semibold text-amber-600">★ {hotel.rating.toFixed(1)} <span className="text-slate-500 font-normal">({hotel.totalReviews} reviews)</span></div>
                  ) : null}
                </div>
              </div>
              {hotel.description && <p className="text-slate-600 leading-relaxed mb-4">{hotel.description}</p>}
              {hotel.phone && <p className="text-sm text-slate-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {hotel.phone}</p>}
            </div>

            {hotel.amenities.length > 0 && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6 mb-6">
                <h2 className="text-lg font-bold text-slate-900 mb-3">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {hotel.amenities.map(a => (
                    <div key={a} className="flex items-center gap-2 text-sm text-slate-600">
                      {amenityIcon(a)} {a}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Choose your room</h2>
              <div className="space-y-3">
                {hotel.rooms.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoom(r)}
                    className={`w-full text-left p-4 rounded-xl border transition ${selectedRoom?.id === r.id ? 'border-etp-500 bg-etp-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{r.name}</h3>
                        <p className="text-xs text-slate-500">{r.type} · Sleeps {r.capacity} · {r.totalRooms} room{r.totalRooms > 1 ? 's' : ''} available</p>
                        {r.bedConfig && <p className="text-xs text-slate-500 mt-1">Bed: {r.bedConfig}</p>}
                        {r.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{r.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-etp-700">BDT {r.price.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">per night</p>
                      </div>
                    </div>
                    {!r.isAvailable && <p className="text-xs text-red-600 mt-2">Currently unavailable</p>}
                  </button>
                ))}
              </div>
            </div>

            {hotel.policy && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6 mb-6">
                <h2 className="text-lg font-bold text-slate-900 mb-3">Hotel policies</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Check-in:</span> <strong>{hotel.policy.checkInTime || '14:00'}</strong></div>
                  <div><span className="text-slate-500">Check-out:</span> <strong>{hotel.policy.checkOutTime || '11:00'}</strong></div>
                  {hotel.policy.cancellationPolicy && (
                    <div className="sm:col-span-2"><span className="text-slate-500">Cancellation:</span> {hotel.policy.cancellationPolicy}</div>
                  )}
                  {hotel.policy.childPolicy && <div><span className="text-slate-500">Children:</span> {hotel.policy.childPolicy}</div>}
                  {hotel.policy.petPolicy && <div><span className="text-slate-500">Pets:</span> {hotel.policy.petPolicy}</div>}
                </div>
              </div>
            )}

            {hotel.reviews.length > 0 && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-3">Recent reviews</h2>
                <div className="space-y-3">
                  {hotel.reviews.map(r => (
                    <div key={r.id} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-slate-900 text-sm">{r.reviewer}</p>
                        <div className="flex items-center gap-0.5 text-amber-500 text-xs">
                          {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                        </div>
                      </div>
                      {r.comment && <p className="text-sm text-slate-600">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Booking sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6 sticky top-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Book your stay</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-slate-500">Check-in</label>
                  <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Check-out</label>
                  <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Guests</label>
                  <input type="number" min="1" value={guests} onChange={e => setGuests(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Promo code (optional)</label>
                  <input value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="E.g. SUMMER10" className="w-full px-3 py-2 border border-slate-200 rounded-lg uppercase" />
                </div>
              </div>

              {quoteLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-etp-600" /></div>
              ) : quote ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {quote.lines.map((l, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span className="text-slate-600">{l.label}</span>
                      <span className={l.amount < 0 ? 'text-green-600' : 'text-slate-900'}>BDT {Math.abs(l.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-slate-100">
                    <span>Total ({quote.nights} night{quote.nights > 1 ? 's' : ''})</span>
                    <span className="text-etp-700">BDT {quote.finalAmount.toLocaleString()}</span>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                <input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} placeholder="Full name" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <input value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} placeholder="Email" type="email" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                <input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>

              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

              <button
                onClick={handleBook}
                disabled={!quote || bookingLoading || !selectedRoom?.isAvailable}
                className="w-full mt-4 bg-gradient-to-r from-etp-600 to-violet-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : isAuthenticated ? 'Book now' : 'Login to book'}
              </button>
              <p className="text-[10px] text-slate-400 mt-2 text-center">Payment confirms after this step. Your booking is held for 30 minutes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
