'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Calendar, User, BedDouble, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../../../lib/apiClient';

interface HotelBooking {
  id: number;
  bookingCode: string;
  status: string;
  paymentStatus: string;
  travelDate: string;
  returnDate: string;
  numberOfPeople: number;
  numberOfRooms: number;
  finalAmount: number;
  source: string;
  room: { id: number; name: string; type: string };
  user: { id: number; fullName: string | null; phone: string };
  payments: Array<{ amount: number; status: string; method: string; paidAt: string | null }>;
}

export default function VendorHotelBookingsPage() {
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/hotel-bookings/vendor/mine' : `/hotel-bookings/vendor/mine?status=${filter}`;
      const res = await api.get<{ bookings: HotelBooking[] }>(url);
      setBookings(res.data.bookings || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hotel Bookings</h1>
        <button onClick={load} className="flex items-center gap-1 text-sm px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'confirmed', 'paid', 'completed', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded bg-red-100 text-red-800 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No hotel bookings yet.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Guest</th>
                <th className="text-left p-3">Room</th>
                <th className="text-left p-3">Dates</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Payment</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{b.bookingCode.slice(0, 8)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 font-medium">
                      <User size={12} /> {b.user.fullName || b.user.phone}
                    </div>
                    <div className="text-xs text-gray-500">{b.numberOfPeople} guest{b.numberOfPeople > 1 ? 's' : ''} · {b.numberOfRooms} room{b.numberOfRooms > 1 ? 's' : ''}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <BedDouble size={12} /> {b.room.name}
                    </div>
                    <div className="text-xs text-gray-500">{b.room.type}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 text-xs">
                      <Calendar size={12} /> {new Date(b.travelDate).toISOString().split('T')[0]}
                    </div>
                    <div className="text-xs text-gray-500">to {new Date(b.returnDate).toISOString().split('T')[0]}</div>
                  </td>
                  <td className="p-3 text-right font-medium">৳{b.finalAmount.toFixed(2)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${b.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {b.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${b.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : b.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{b.source}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
