'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, BedDouble, Users, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import api from '../../../../lib/apiClient';

interface DashboardSummary {
  hotels: Array<{ id: number; businessName: string; status: string; isVerified: boolean }>;
  rooms: { total: number; available: number };
  bookings: { total: number; pending: number; confirmed: number; completed: number; cancelled: number };
  todayCheckIns: number;
  todayCheckOuts: number;
  revenue: { gross: number; commissionRate: number; commission: number; net: number; currency: string };
}

export default function VendorHotelDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DashboardSummary>('/hotels/dashboard/summary');
      setSummary(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;
  }

  if (error || !summary) {
    return <div className="p-8 text-red-700">{error || 'No data'}</div>;
  }

  const occupancyRate = summary.rooms.total > 0 ? Math.round(((summary.rooms.total - summary.rooms.available) / summary.rooms.total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Hotel Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Hotels</div>
              <div className="text-2xl font-bold">{summary.hotels.length}</div>
            </div>
            <BedDouble size={32} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Rooms (inventory)</div>
              <div className="text-2xl font-bold">{summary.rooms.total}</div>
              <div className="text-xs text-gray-500">{summary.rooms.available} bookable</div>
            </div>
            <BedDouble size={32} className="text-emerald-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Bookings</div>
              <div className="text-2xl font-bold">{summary.bookings.total}</div>
              <div className="text-xs text-gray-500">{summary.bookings.confirmed} confirmed, {summary.bookings.pending} pending</div>
            </div>
            <Users size={32} className="text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Net Revenue (after ETP commission)</div>
              <div className="text-2xl font-bold">৳{summary.revenue.net.toFixed(2)}</div>
              <div className="text-xs text-gray-500">From ৳{summary.revenue.gross.toFixed(2)} gross</div>
            </div>
            <DollarSign size={32} className="text-amber-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">Today&apos;s Check-ins</div>
          <div className="text-3xl font-bold text-emerald-600">{summary.todayCheckIns}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">Today&apos;s Check-outs</div>
          <div className="text-3xl font-bold text-blue-600">{summary.todayCheckOuts}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-500">Occupancy (this property)</div>
          <div className="text-3xl font-bold">{occupancyRate}%</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/vendor/hotels" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            Manage Hotels
          </Link>
          <Link href="/vendor/hotels/bookings" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm">
            View Bookings
          </Link>
          <Link href="/vendor/scanner" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm">
            QR Scanner
          </Link>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">My Hotels</h2>
        {summary.hotels.length === 0 ? (
          <div className="text-gray-500">No hotels registered yet. <Link href="/vendor/hotels" className="text-blue-600 underline">Create one</Link>.</div>
        ) : (
          <ul className="divide-y">
            {summary.hotels.map(h => (
              <li key={h.id} className="py-2 flex items-center justify-between">
                <div>
                  <Link href={`/vendor/hotels/${h.id}`} className="font-medium text-blue-700">{h.businessName}</Link>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-100">{h.status}</span>
                </div>
                {h.isVerified ? <span className="text-xs text-emerald-600">Verified</span> : <span className="text-xs text-amber-600">Pending verification</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
