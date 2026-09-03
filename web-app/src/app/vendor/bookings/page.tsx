'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../lib/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import { Loader2, ArrowLeft, Ticket, CheckCircle, XCircle, Check, Filter } from 'lucide-react';
import type { Booking } from '../../../types/booking';

type FilterKey = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' }
];

function statusBadge(status: string, payment: string) {
  const map: Record<string, string> = {
    'pending-pending': 'bg-yellow-100 text-yellow-800',
    'confirmed-paid': 'bg-green-100 text-green-800',
    'completed-paid': 'bg-blue-100 text-blue-800',
    'cancelled-': 'bg-red-100 text-red-800',
    'cancelled-refunded': 'bg-orange-100 text-orange-800'
  };
  const cls = map[`${status}-${payment}`] || 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

export default function VendorBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async (f: FilterKey = 'all') => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (f !== 'all') params.status = f;
      const res = await api.get<Booking[]>(`/vendors/bookings`, { params });
      setBookings(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'vendor') load(filter); }, [user, filter, load]);

  const manage = async (id: number, status: string) => {
    setActionId(id);
    try {
      await api.patch(`/vendors/bookings/${id}`, { status });
      load(filter);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  if (user?.role !== 'vendor') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Vendor access required.</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Bookings</h1>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">{error}</div>}

        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-500">Bookings for your services will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(b => (
              <div key={b.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">#{b.bookingCode}</span>
                      {statusBadge(b.status, b.paymentStatus)}
                    </div>
                    <p className="text-sm text-gray-600">
                      Customer: <span className="font-medium text-gray-800">{b.user?.fullName || 'N/A'}</span>
                      {b.user?.phone ? ` · ${b.user.phone}` : ''}
                    </p>
                    <p className="text-sm text-gray-600">
                      {b.service ? b.service.name : (b.route || b.category)}
                      {b.seatNumbers ? ` · Seats ${b.seatNumbers}` : ''}
                    </p>
                    <p className="text-sm text-gray-500">Travel: {new Date(b.travelDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-sm font-semibold text-blue-700 mt-1">BDT {b.finalAmount.toFixed(2)} · {b.paymentStatus}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {b.status === 'pending' && (
                      <>
                        <button onClick={() => manage(b.id, 'confirmed')} disabled={actionId === b.id} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Accept
                        </button>
                        <button onClick={() => manage(b.id, 'cancelled')} disabled={actionId === b.id} className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {b.status === 'confirmed' && b.paymentStatus === 'paid' && (
                      <button onClick={() => manage(b.id, 'completed')} disabled={actionId === b.id} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
