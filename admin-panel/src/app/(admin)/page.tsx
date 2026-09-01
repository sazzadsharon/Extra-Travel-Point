'use client';

import React, { useEffect, useState } from 'react';
import { CreditCard, QrCode, CheckCircle, Users, TrendingUp, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import { api, ApiError } from '../../lib/api';
import { BookingRow, RevenueStats, VendorCounts } from '../../lib/types';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
  SUSPENDED: '#6b7280',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<RevenueStats>({
    totalBookings: 0, paidBookingsCount: 0, totalRevenue: 0, totalDiscountsGiven: 0, currency: 'BDT',
  });
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [vendorCounts, setVendorCounts] = useState<VendorCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rev, bk, ven] = await Promise.all([
        api<RevenueStats>('/api/v1/admin/revenue'),
        api<BookingRow[]>('/api/v1/admin/bookings'),
        api<{ providers: any[]; counts: VendorCounts[] }>('/api/v1/admin/vendors'),
      ]);
      setStats(rev);
      setBookings(Array.isArray(bk) ? bk : []);
      setVendorCounts(ven.counts || []);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeVendors = vendorCounts.find(c => c.status === 'APPROVED')?._count.id ?? 0;
  const pendingVendors = vendorCounts.find(c => c.status === 'PENDING')?._count.id ?? 0;

  const pieData = vendorCounts.map(c => ({ name: c.status, value: c._count.id }));
  const paidBookings = bookings.filter(b => b.paymentStatus === 'paid');
  const totalFare = paidBookings.reduce((s, b) => s + (b.finalAmount || 0), 0);
  const totalDiscount = paidBookings.reduce((s, b) => s + (b.discountAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">সিস্টেম ড্যাশবোর্ড</h2>
          <p className="text-sm text-slate-500">Extra Travel Point — Travel Super App Operations</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<CreditCard className="w-5 h-5 text-emerald-600" />}
          label="মোট আয় (Total Revenue)"
          value={`৳ ${(stats.totalRevenue || totalFare).toLocaleString()}`}
          sub="Paid bookings total"
          color="emerald"
        />
        <StatCard
          icon={<QrCode className="w-5 h-5 text-sky-600" />}
          label="মোট ডিসকাউন্ট প্রদান"
          value={`৳ ${(stats.totalDiscountsGiven || totalDiscount).toLocaleString()}`}
          sub="Customer savings"
          color="sky"
        />
        <StatCard
          icon={<CheckCircle className="w-5 h-5 text-indigo-600" />}
          label="মোট বুকিং"
          value={stats.totalBookings.toString()}
          sub={`${stats.paidBookingsCount} paid`}
          color="indigo"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-purple-600" />}
          label="একটিভ ভেন্ডর"
          value={activeVendors.toString()}
          sub={`${pendingVendors} pending review`}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">সাম্প্রতিক বুকিং (Recent Bookings)</h3>
          {bookings.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">No bookings yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(0, 6).map(b => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-3 font-mono text-xs">{b.bookingCode?.slice(0, 12)}…</td>
                      <td className="py-3 capitalize">{b.category}</td>
                      <td className="py-3">৳ {b.finalAmount?.toLocaleString()}</td>
                      <td className="py-3"><StatusBadge value={b.status} /></td>
                      <td className="py-3"><StatusBadge value={b.paymentStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 text-right">
            <Link href="/bookings" className="text-sm text-sky-600 hover:underline">View all bookings →</Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">ভেন্ডর পরিস্থিতি</h3>
          {pieData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No vendors</p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[d.name] || '#94a3b8' }} />
                      <span className="capitalize text-slate-600">{d.name}</span>
                    </div>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction href="/vendors" icon={<Clock className="w-4 h-4" />} label="Pending Vendors" count={pendingVendors} />
          <QuickAction href="/bookings" icon={<TrendingUp className="w-4 h-4" />} label="Recent Bookings" count={bookings.length} />
          <QuickAction href="/users" icon={<Users className="w-4 h-4" />} label="User List" count={null} />
          <QuickAction href="/fraud" icon={<AlertCircle className="w-4 h-4" />} label="Fraud Center" count={null} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm text-slate-500">{label}</span>
        <div className={`w-10 h-10 bg-${color}-100 rounded-lg flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-800',
    paid: 'bg-emerald-100 text-emerald-800',
    completed: 'bg-blue-100 text-blue-800',
    pending: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-red-100 text-red-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    PENDING: 'bg-amber-100 text-amber-800',
    REJECTED: 'bg-red-100 text-red-800',
    SUSPENDED: 'bg-gray-100 text-gray-800',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[value] || 'bg-slate-100 text-slate-700'}`}>{value}</span>;
}

function QuickAction({ href, icon, label, count }: { href: string; icon: React.ReactNode; label: string; count: number | null }) {
  return (
    <Link href={href} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-sky-400 hover:bg-sky-50 transition">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      {count != null && <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-semibold">{count}</span>}
    </Link>
  );
}
