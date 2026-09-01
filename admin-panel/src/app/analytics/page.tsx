'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, ShoppingCart, Users, Download, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsData {
  totalBookings: number;
  paidBookingsCount: number;
  totalRevenue: number;
  totalDiscountsGiven: number;
  currency: string;
}

interface BookingStats {
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsReports() {
  const [stats, setStats] = useState<AnalyticsData>({
    totalBookings: 0,
    paidBookingsCount: 0,
    totalRevenue: 0,
    totalDiscountsGiven: 0,
    currency: 'BDT'
  });
  const [bookingStats, setBookingStats] = useState<BookingStats>({
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  const chartData = [
    { name: 'Jan', bookings: 45, revenue: 120000 },
    { name: 'Feb', bookings: 38, revenue: 95000 },
    { name: 'Mar', bookings: 52, revenue: 140000 },
    { name: 'Apr', bookings: 48, revenue: 125000 },
    { name: 'May', bookings: 61, revenue: 165000 },
    { name: 'Jun', bookings: 55, revenue: 148000 },
  ];

  const categoryData = [
    { name: 'Bus', value: 35 },
    { name: 'Hotel', value: 28 },
    { name: 'Flight', value: 15 },
    { name: 'Tour', value: 12 },
    { name: 'Food', value: 10 },
  ];

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_URL}/api/v1/admin/revenue`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.log('Backend API offline, using demo data');
        setStats({
          totalBookings: 156,
          paidBookingsCount: 128,
          totalRevenue: 485000,
          totalDiscountsGiven: 42500,
          currency: 'BDT'
        });
        setBookingStats({
          pending: 12,
          confirmed: 45,
          completed: 85,
          cancelled: 14
        });
      }
      setIsLoading(false);
    }
    fetchAnalytics();
  }, [dateRange]);

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      dateRange: `${dateRange} days`,
      stats,
      bookingStats
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etp-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Analytics & Reports</h2>
          <p className="text-sm text-slate-500">Business performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button
            onClick={exportReport}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-sky-700"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">Total Revenue</span>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">৳ {stats.totalRevenue.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600">
            <ArrowUp className="w-3 h-3" />
            <span>+12.5% from last period</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">Total Bookings</span>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.totalBookings}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-blue-600">
            <ArrowUp className="w-3 h-3" />
            <span>+8.3% from last period</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">Paid Bookings</span>
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.paidBookingsCount}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
            <span>{stats.totalBookings > 0 ? Math.round((stats.paidBookingsCount / stats.totalBookings) * 100) : 0}% conversion</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">Discounts Given</span>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">৳ {stats.totalDiscountsGiven.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
            <ArrowDown className="w-3 h-3" />
            <span>-5.2% from last period</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`৳ ${value.toLocaleString()}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bookings Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Bookings Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="bookings" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Distribution & Booking Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Pie Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Bookings by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {categoryData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-slate-600">{entry.name} ({entry.value}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Booking Status */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Booking Status Distribution</h3>
          <div className="space-y-4">
            {[
              { label: 'Pending', value: bookingStats.pending, color: 'bg-amber-500' },
              { label: 'Confirmed', value: bookingStats.confirmed, color: 'bg-blue-500' },
              { label: 'Completed', value: bookingStats.completed, color: 'bg-green-500' },
              { label: 'Cancelled', value: bookingStats.cancelled, color: 'bg-red-500' },
            ].map(item => {
              const total = bookingStats.pending + bookingStats.confirmed + bookingStats.completed + bookingStats.cancelled;
              const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-medium text-slate-900">{item.value} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
