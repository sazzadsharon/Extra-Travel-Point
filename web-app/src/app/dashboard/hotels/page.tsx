'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, BedDouble, Calendar, Users } from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/apiClient';

interface HotelBookingRow {
  id: number;
  bookingCode: string;
  status: string;
  paymentStatus: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  numberOfRooms: number;
  finalAmount: number;
  currency: string;
  hotel: { businessName: string; address: string };
  room: { name: string; type: string };
  createdAt: string;
}

export default function CustomerHotelBookingsPage() {
  const [bookings, setBookings] = useState<HotelBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ bookings: HotelBookingRow[] }>('/hotel-bookings/customer/mine');
      setBookings(res.data.bookings || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === 'all' ? bookings : bookings.filter(b => b.status === statusFilter);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-etp-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">My Hotel Bookings</h1>
        <p className="text-slate-500 mb-6">View and manage your hotel reservations</p>

        <div className="mb-4 flex gap-2 flex-wrap">
          {['all', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? 'bg-etp-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && <div className="text-red-600 mb-4">{error}</div>}

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">No hotel bookings yet</p>
            <Link href="/hotels" className="inline-block bg-etp-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-etp-700">Browse hotels</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(b => (
              <Link key={b.id} href={`/hotels/bookings/${b.id}`} className="block bg-white rounded-2xl p-5 border border-slate-100 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{b.hotel.businessName}</h3>
                    <p className="text-sm text-slate-500">{b.hotel.address}</p>
                    <p className="text-xs text-slate-500 mt-1">{b.room.name} · {b.numberOfRooms} room{b.numberOfRooms > 1 ? 's' : ''} · {b.numberOfGuests} guest{b.numberOfGuests > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-semibold ${
                      b.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {b.paymentStatus}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">{b.status}</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">৳{b.finalAmount.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(b.checkInDate).toLocaleDateString()} → {new Date(b.checkOutDate).toLocaleDateString()}</span>
                  <span className="text-slate-400">·</span>
                  <span>Code: {b.bookingCode}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
