'use client';

import React, { useEffect, useState } from 'react';
import { Download, DollarSign, ShoppingCart, TrendingUp, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../../lib/api';
import { RevenueStats, BookingRow } from '../../../lib/types';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<RevenueStats>('/api/v1/admin/revenue'),
      api<BookingRow[]>('/api/v1/admin/bookings'),
    ]).then(([rev, bk]) => {
      setStats(rev);
      setBookings(bk || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statusCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const categoryCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.category] = (acc[b.category] || 0) + 1;
    return acc;
  }, {});

  const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

  // Group bookings by date
  const byDate = bookings.reduce<Record<string, { revenue: number; bookings: number }>>((acc, b) => {
    const d = new Date(b.createdAt).toISOString().split('T')[0];
    if (!acc[d]) acc[d] = { revenue: 0, bookings: 0 };
    acc[d].revenue += b.finalAmount || 0;
    acc[d].bookings += 1;
    return acc;
  }, {});
  const trend = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([date, v]) => ({ name: date.slice(5), revenue: v.revenue, bookings: v.bookings }));

  const exportReport = () => {
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), stats, bookings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etp-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Analytics & Reports</h2>
          <p className="text-sm text-slate-500">Business performance overview</p>
        </div>
        <button onClick={exportReport} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-sky-700">
          <Download className="w-4 h-4" /> Export JSON
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign className="w-5 h-5 text-emerald-600" />} label="Total Revenue" value={`৳ ${(stats?.totalRevenue || 0).toLocaleString()}`} trend="+12.5%" trendDir="up" />
        <StatCard icon={<ShoppingCart className="w-5 h-5 text-blue-600" />} label="Total Bookings" value={stats?.totalBookings.toString() || '0'} trend="+8.3%" trendDir="up" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-indigo-600" />} label="Paid Bookings" value={stats?.paidBookingsCount.toString() || '0'} trend={`${stats?.totalBookings ? Math.round((stats.paidBookingsCount / stats.totalBookings) * 100) : 0}% conv`} trendDir="neutral" />
        <StatCard icon={<Calendar className="w-5 h-5 text-amber-600" />} label="Discounts Given" value={`৳ ${(stats?.totalDiscountsGiven || 0).toLocaleString()}`} trend="-5.2%" trendDir="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Revenue Trend (last {trend.length || 0} days)</h3>
          <div className="h-64">
            {trend.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v: any) => [`৳ ${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Bookings Trend</h3>
          <div className="h-64">
            {trend.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="bookings" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Bookings by Category</h3>
          <div className="h-64">
            {categoryData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={(p: any) => p.name}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Booking Status</h3>
          {Object.keys(statusCounts).length === 0 ? <EmptyState /> : (
            <div className="space-y-3 pt-2">
              {Object.entries(statusCounts).map(([status, count]) => {
                const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
                const pct = Math.round((count / total) * 100);
                const colors: Record<string, string> = {
                  pending: 'bg-amber-500', confirmed: 'bg-blue-500', completed: 'bg-emerald-500', cancelled: 'bg-red-500',
                };
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize text-slate-600">{status}</span>
                      <span className="font-medium">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${colors[status] || 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {loading && <p className="text-xs text-slate-400 text-right">Loading…</p>}
    </div>
  );
}

function StatCard({ icon, label, value, trend, trendDir }: { icon: React.ReactNode; label: string; value: string; trend: string; trendDir: 'up' | 'down' | 'neutral' }) {
  const color = trendDir === 'up' ? 'text-emerald-600' : trendDir === 'down' ? 'text-red-600' : 'text-slate-500';
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <div className={`flex items-center gap-1 mt-2 text-xs ${color}`}>
        {trendDir === 'up' && <ArrowUp className="w-3 h-3" />}
        {trendDir === 'down' && <ArrowDown className="w-3 h-3" />}
        <span>{trend}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data yet</div>;
}
