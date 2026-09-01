'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api';
import { BookingRow } from '../../../lib/types';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<BookingRow[]>('/api/v1/admin/bookings');
      setBookings(Array.isArray(data) ? data : []);
    } catch (e) {
      // graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => bookings.filter(b => {
    const matchesSearch = !search || (b.bookingCode || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesCat = categoryFilter === 'all' || b.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCat;
  }), [bookings, search, statusFilter, categoryFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">বুকিং ম্যানেজমেন্ট</h2>
          <p className="text-sm text-slate-500">{bookings.length} total bookings</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by booking code..."
              className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
            <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="bus">Bus</option>
              <option value="hotel">Hotel</option>
              <option value="flight">Flight</option>
              <option value="tour">Tour</option>
              <option value="food">Food</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
              <tr>
                <th className="p-4">Booking Code</th>
                <th className="p-4">Category</th>
                <th className="p-4">Travel Date</th>
                <th className="p-4">Fare</th>
                <th className="p-4">Status</th>
                <th className="p-4">Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-500">No bookings match your filters</td></tr>
              ) : filtered.map(b => (
                <tr key={b.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-mono text-xs">{b.bookingCode}</td>
                  <td className="p-4 capitalize">{b.category}</td>
                  <td className="p-4">{b.travelDate ? new Date(b.travelDate).toLocaleDateString() : '—'}</td>
                  <td className="p-4 font-medium">৳ {b.finalAmount?.toLocaleString()}</td>
                  <td className="p-4"><Badge value={b.status} /></td>
                  <td className="p-4"><Badge value={b.paymentStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-800',
    paid: 'bg-emerald-100 text-emerald-800',
    completed: 'bg-blue-100 text-blue-800',
    pending: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800',
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[value] || 'bg-slate-100 text-slate-700'}`}>{value}</span>;
}
