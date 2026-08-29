'use client';

import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, BookOpen, QrCode, CreditCard, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalBookings: 24,
    paidBookingsCount: 18,
    totalRevenue: 145000,
    totalDiscountsGiven: 18500,
    currency: 'BDT'
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'bookings' | 'providers' | 'qr'>('dashboard');
  const [recentBookings, setRecentBookings] = useState<any[]>([
    { id: 'BKG-101', user: { fullName: 'Shakib Al Hasan' }, category: 'hotel', totalAmount: 12000, discountAmount: 1200, status: 'confirmed', createdAt: '2026-08-25' },
    { id: 'BKG-102', user: { fullName: 'Tamim Iqbal' }, category: 'flight', totalAmount: 8500, discountAmount: 850, status: 'confirmed', createdAt: '2026-08-25' },
    { id: 'BKG-103', user: { fullName: 'Mushfiqur Rahim' }, category: 'bus', totalAmount: 1500, discountAmount: 150, status: 'pending', createdAt: '2026-08-26' },
  ]);
  const [providers, setProviders] = useState<any[]>([
    { id: 1, businessName: 'Cox Bazar Palace Hotel', category: 'hotel', commissionRate: 10, isVerified: true, address: 'Cox Bazar Beach Road' },
    { id: 2, businessName: 'Green Line Paribahan', category: 'bus', commissionRate: 8, isVerified: true, address: 'Dhaka - Chittagong' },
    { id: 3, businessName: 'Sylhet Resort & Spa', category: 'hotel', commissionRate: 12, isVerified: false, address: 'Sreemangal, Sylhet' }
  ]);

  // Mock chart data for revenue chart
  const chartData = [
    { month: 'Jan', revenue: 4000, discount: 400 },
    { month: 'Feb', revenue: 3000, discount: 300 },
    { month: 'Mar', revenue: 5000, discount: 500 },
    { month: 'Apr', revenue: 4000, discount: 400 },
    { month: 'May', revenue: 6000, discount: 600 },
    { month: 'Jun', revenue: 5000, discount: 500 },
  ];

  useEffect(() => {
    async function fetchData() {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const revRes = await fetch(`${API_URL}/api/v1/admin/revenue`);
        if (revRes.ok) {
          const revData = await revRes.json();
          setStats(revData);
        }
        const bkgRes = await fetch(`${API_URL}/api/v1/admin/bookings`);
        if (bkgRes.ok) {
          const bkgData = await bkgRes.json();
          if (Array.isArray(bkgData) && bkgData.length > 0) setRecentBookings(bkgData);
        }
        const prvRes = await fetch(`${API_URL}/api/v1/admin/providers`);
        if (prvRes.ok) {
          const prvData = await prvRes.json();
          if (Array.isArray(prvData) && prvData.length > 0) setProviders(prvData);
        }
      } catch (err) {
        console.log('Backend API offline or CORS, using initial demo data');
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-8">
            <div className="bg-sky-500 p-2 rounded-lg text-white">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">এক্সট্রাভেল পয়েন্ট</h1>
              <p className="text-xs text-slate-400">Admin Control Panel</p>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <LayoutDashboard size={18} />
              <span>ড্যাশবোর্ড (Analytics)</span>
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'bookings' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <BookOpen size={18} />
              <span>বুকিং লিস্ট</span>
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === 'providers' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Users size={18} />
              <span>সার্ভিস প্রোভাইডার</span>
            </button>
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold">A</div>
            <div>
              <p className="text-sm font-medium">Admin User</p>
              <p className="text-xs text-slate-400">admin@extratravel.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'dashboard' && 'সিস্টেম ড্যাশবোর্ড ও অ্যানালিটিক্স'}
              {activeTab === 'bookings' && 'বুকিং ম্যানেজমেন্ট'}
              {activeTab === 'providers' && 'সার্ভিস প্রোভাইডার ভেরিফিকেশন'}
            </h2>
            <p className="text-sm text-slate-500">Extra Travel Point Protocol v1.0 Overview</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
            ● Backend Engine Online (Port 5000)
          </span>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-slate-500 mb-2">
                  <span className="text-sm font-medium">মোট আয় (Total Revenue)</span>
                  <CreditCard size={20} className="text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">৳ {stats.totalRevenue.toLocaleString()}</p>
                <span className="text-xs text-emerald-600 font-semibold">+14.2% from last month</span>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-slate-500 mb-2">
                  <span className="text-sm font-medium">মোট ডিসকাউন্ট প্রদান</span>
                  <QrCode size={20} className="text-sky-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">৳ {stats.totalDiscountsGiven.toLocaleString()}</p>
                <span className="text-xs text-sky-600 font-semibold">Combo QR Discounts</span>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-slate-500 mb-2">
                  <span className="text-sm font-medium">সফল বুকিং</span>
                  <CheckCircle size={20} className="text-indigo-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{stats.paidBookingsCount}</p>
                <span className="text-xs text-indigo-600 font-semibold">{stats.totalBookings} Total Bookings</span>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-slate-500 mb-2">
                  <span className="text-sm font-medium">একটিভ প্রোভাইডার</span>
                  <Users size={20} className="text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">12</p>
                <span className="text-xs text-purple-600 font-semibold">Hotels, Buses, Tour spots</span>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">মাসভিত্তিক রাজস্ব ও ডিসকাউন্ট (Revenue Overview)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#0284c7" radius={[4, 4, 0, 0]} name="Revenue (BDT)" />
                    <Bar dataKey="discount" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Discount (BDT)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                <tr>
                  <th className="p-4">বুকিং আইডি</th>
                  <th className="p-4">গ্রাহক</th>
                  <th className="p-4">ক্যাটাগরি</th>
                  <th className="p-4">পরিমাণ</th>
                  <th className="p-4">ডিসকাউন্ট</th>
                  <th className="p-4">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b: any) => (
                  <tr key={b.id || b.bookingCode} className="border-b hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-900">{b.bookingCode || b.id}</td>
                    <td className="p-4">{typeof b.user === 'object' ? (b.user?.fullName || b.user?.phone || 'Customer') : b.user}</td>
                    <td className="p-4 uppercase text-xs font-semibold">{b.category}</td>
                    <td className="p-4">BDT {b.totalAmount || b.amount}</td>
                    <td className="p-4 text-emerald-600 font-medium">BDT {b.discountAmount || b.discount}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                <tr>
                  <th className="p-4">বিজনেস নাম</th>
                  <th className="p-4">ক্যাটাগরি</th>
                  <th className="p-4">ঠিকানা</th>
                  <th className="p-4">কমিশন রেট</th>
                  <th className="p-4">ভেরিফিকেশন</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-slate-50">
                    <td className="p-4 font-semibold text-slate-900">{p.businessName || p.name}</td>
                    <td className="p-4 uppercase text-xs font-bold text-slate-500">{p.category}</td>
                    <td className="p-4">{p.address}</td>
                    <td className="p-4">{p.commissionRate ? `${p.commissionRate}%` : p.commission}</td>
                    <td className="p-4">
                      {p.isVerified ? (
                        <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Verified</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">Pending Approval</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
