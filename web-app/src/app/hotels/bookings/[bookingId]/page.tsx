'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, MapPin, Calendar, Users, BedDouble, Download } from 'lucide-react';
import Link from 'next/link';
import api from '../../../../lib/apiClient';

interface HotelBooking {
  id: number;
  bookingCode: string;
  status: string;
  paymentStatus: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  numberOfRooms: number;
  finalAmount: number;
  baseAmount: number;
  taxAmount: number;
  serviceFee: number;
  discountAmount: number;
  currency: string;
  customerInfo: { name?: string; email?: string; phone?: string };
  source: string;
  hotel: { id: number; businessName: string; address: string; city?: string; phone?: string; starRating?: number };
  room: { id: number; name: string; type: string; bedConfig?: string; capacity: number };
  ratePlan?: { id: number; name: string; mealPlan: string } | null;
  createdAt: string;
}

export default function HotelETicketPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params?.bookingId as string;
  const [booking, setBooking] = useState<HotelBooking | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const res = await api.get<{ booking: HotelBooking }>(`/hotel-bookings/${bookingId}`);
      setBooking(res.data.booking);
      if (res.data.booking.status === 'confirmed' || res.data.booking.paymentStatus === 'paid') {
        try {
          const qrRes = await api.get<{ qrDataUrl: string }>(`/qr/generate/${bookingId}`);
          setQrDataUrl(qrRes.data.qrDataUrl);
        } catch {
          // ignore - QR will be hidden
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async () => {
    if (!booking) return;
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api.patch(`/hotel-bookings/${bookingId}/cancel`, { reason: 'Customer requested' });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel booking');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-etp-600" /></div>;
  }
  if (error || !booking) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'Booking not found'}</div>;
  }

  const nights = Math.ceil(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / 86400000
  );
  const isCancellable = ['pending', 'confirmed'].includes(booking.status);
  const isPaid = booking.paymentStatus === 'paid';

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-slate-500">Booking</p>
              <h1 className="text-2xl font-bold text-slate-900">{booking.bookingCode}</h1>
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 text-xs rounded-full font-semibold ${
                isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {booking.paymentStatus}
              </span>
              <p className="text-xs text-slate-500 mt-1">{booking.status}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h2 className="text-lg font-bold text-slate-900">{booking.hotel.businessName}</h2>
            <p className="text-sm text-slate-600 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {booking.hotel.address}{booking.hotel.city ? `, ${booking.hotel.city}` : ''}
            </p>
            {booking.hotel.phone && <p className="text-sm text-slate-600">Phone: {booking.hotel.phone}</p>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Check-in</p>
              <p className="font-semibold text-slate-900 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {new Date(booking.checkInDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Check-out</p>
              <p className="font-semibold text-slate-900 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {new Date(booking.checkOutDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Nights</p>
              <p className="font-semibold text-slate-900">{nights}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Guests</p>
              <p className="font-semibold text-slate-900 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {booking.numberOfGuests}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Rooms</p>
              <p className="font-semibold text-slate-900">{booking.numberOfRooms}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Room</p>
              <p className="font-semibold text-slate-900 flex items-center gap-1">
                <BedDouble className="w-3.5 h-3.5" /> {booking.room.name} ({booking.room.type})
              </p>
            </div>
            {booking.ratePlan && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Rate Plan</p>
                <p className="font-semibold text-slate-900">{booking.ratePlan.name} ({booking.ratePlan.mealPlan})</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Price breakdown</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Base</span><span>৳{booking.baseAmount.toFixed(2)}</span></div>
              {booking.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-৳{booking.discountAmount.toFixed(2)}</span></div>}
              {booking.taxAmount > 0 && <div className="flex justify-between"><span className="text-slate-600">Tax</span><span>৳{booking.taxAmount.toFixed(2)}</span></div>}
              {booking.serviceFee > 0 && <div className="flex justify-between"><span className="text-slate-600">Service fee</span><span>৳{booking.serviceFee.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-slate-100"><span>Total</span><span>৳{booking.finalAmount.toFixed(2)}</span></div>
            </div>
          </div>

          {qrDataUrl && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500 mb-2">Show this QR at the front desk for check-in</p>
              <img src={qrDataUrl} alt="Booking QR" className="inline-block w-48 h-48 border border-slate-200 rounded-lg" />
              <a href={qrDataUrl} download={`ept-hotel-${booking.bookingCode}.png`} className="block mt-2 text-sm text-etp-600 inline-flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Download QR
              </a>
            </div>
          )}

          {!isPaid && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link href="/hotels" className="block w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-2.5 rounded-xl font-semibold text-center hover:opacity-90">
                Complete payment
              </Link>
            </div>
          )}

          {isCancellable && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button onClick={handleCancel} className="block w-full text-red-600 border border-red-300 py-2.5 rounded-xl font-semibold hover:bg-red-50">
                Cancel booking
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 text-center">Booked via EPT · {new Date(booking.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
