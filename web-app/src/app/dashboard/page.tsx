'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { API_CONFIG } from '../../config/api';
import {
  Bus,
  Calendar,
  Clock,
  MapPin,
  Users,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  QrCode,
  Download,
  Share2,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Booking {
  id: number;
  bookingCode: string;
  userId: number;
  providerId: number;
  category: string;
  bookingDate: string;
  travelDate: string;
  numberOfPeople: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  paymentStatus: string;
  qrCode?: string;
  createdAt: string;
  provider?: {
    businessName: string;
    category: string;
    address: string;
    city?: string;
  };
  user?: {
    fullName?: string;
    phone?: string;
  };
  payments?: Array<{
    id: number;
    transactionId: string;
    amount: number;
    method: string;
    status: string;
    paidAt?: string;
  }>;
}

type TabFilter = 'all' | 'upcoming' | 'completed' | 'cancelled';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('upcoming');
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);
    try {
      const { default: axios } = await import('axios');
      const response = await axios.get<Booking[]>(`${API_CONFIG.API_BASE_URL}/bookings`);
      setBookings(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user, fetchBookings]);

  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'upcoming') {
      return b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'refunded';
    }
    if (activeTab === 'completed') {
      return b.status === 'confirmed' || b.status === 'completed';
    }
    if (activeTab === 'cancelled') {
      return b.status === 'cancelled';
    }
    return true;
  });

  const cancelBooking = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const { default: axios } = await import('axios');
      await axios.patch(`${API_CONFIG.API_BASE_URL}/bookings/${id}/cancel`);
      fetchBookings();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel booking');
    }
  };

  const getStatusBadge = (status: string, paymentStatus: string) => {
    const combined = `${status}-${paymentStatus}`;
    switch (combined) {
      case 'confirmed-paid':
      case 'completed-paid':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Confirmed</span>;
      case 'pending-pending':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>;
      case 'cancelled-':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1"><XCircle className="w-3 h-3" />Cancelled</span>;
      case 'pending-refunded':
      case 'cancelled-refunded':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Refunded</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">{status}</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const upcomingCount = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'refunded').length;
  const completedCount = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length;
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please login to view your dashboard</p>
          <Link
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Dashboard</h1>
          <p className="text-gray-600">Manage your bookings and travel plans</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{upcomingCount}</p>
                <p className="text-sm text-gray-500">Upcoming</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
                <p className="text-sm text-gray-500">Completed</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{cancelledCount}</p>
                <p className="text-sm text-gray-500">Cancelled</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {bookings.filter(b => b.paymentStatus === 'paid').length}
                </p>
                <p className="text-sm text-gray-500">Paid</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
            { key: 'all', label: 'All Bookings' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabFilter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label} ({tab.key === 'upcoming' ? upcomingCount : tab.key === 'completed' ? completedCount : tab.key === 'cancelled' ? cancelledCount : bookings.length})
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
                <div className="h-10 bg-gray-200 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Bus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-600 mb-6">
              {activeTab !== 'all'
                ? `You have no ${activeTab} bookings`
                : 'Start your journey by searching for transport'}
            </p>
            <Link
              href="/transport"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <Bus className="w-4 h-4" />
              Book Now
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBookings.map((booking, index) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-200">Booking #{booking.bookingCode}</p>
                      <p className="font-semibold capitalize">{booking.category}</p>
                    </div>
                    {getStatusBadge(booking.status, booking.paymentStatus)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{formatDate(booking.travelDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{booking.numberOfPeople} passenger(s)</span>
                  </div>
                  {booking.provider?.businessName && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Bus className="w-4 h-4 text-gray-400" />
                      <span>{booking.provider.businessName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">Total Paid</span>
                    <span className="font-bold text-gray-900">BDT {booking.finalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <div className="flex flex-col gap-2">
                     <Link
                       href={`/ticket/${booking.id}`}
                       className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                     >
                       View Details
                       <ArrowRight className="w-3 h-3" />
                     </Link>
                     <div className="flex gap-2">
                       {booking.qrCode && (
                         <Link
                           href={`/ticket/${booking.id}`}
                           className="flex-1 text-center bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                         >
                           <QrCode className="w-3 h-3" />
                           Ticket
                         </Link>
                       )}
                      {(booking.status === 'confirmed' || booking.status === 'pending') && (
                        <button
                          onClick={() => cancelBooking(booking.id)}
                          className="flex-1 text-center bg-white hover:bg-red-50 text-red-600 border border-red-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
