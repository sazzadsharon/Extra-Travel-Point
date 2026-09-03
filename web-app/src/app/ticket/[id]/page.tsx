'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle, Bus, MapPin, Calendar, Users, CreditCard, Download, Share2, ArrowLeft, Ticket, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../../lib/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

interface BookingDetail {
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
  seatNumbers?: string | null;
  passengerInfo?: string | null;
  route?: string | null;
  createdAt: string;
  provider?: {
    businessName: string;
    category: string;
    address: string;
    city?: string;
    phone?: string;
    rating: number;
    totalReviews: number;
  };
  user?: {
    fullName?: string;
    phone?: string;
    email?: string;
  };
}

interface TicketQrObject {
  payload: Record<string, unknown>;
  signature: string;
}

interface Ticket {
  ticketId: string;
  bookingCode: string;
  bookingStatus: string;
  paymentStatus: string;
  category: string;
  route: string | null;
  travelDate: string;
  bookingDate: string;
  seats: string[];
  passengers: Array<{
    name: string;
    email: string;
    phone: string;
    age?: number;
    gender?: 'male' | 'female' | 'other';
    seatNumber?: string;
  }> | null;
  fare: {
    total: number;
    discount: number;
    final: number;
    currency: string;
  };
  provider: {
    id: number;
    businessName: string;
    category: string;
    city: string | null;
    phone: string | null;
  };
  customer: { id: number; fullName: string | null; phone: string };
  service: { id: number; name: string; route: string | null } | null;
  qr: {
    object: TicketQrObject;
    dataUrl: string | null;
    validFrom: string;
    validUntil: string;
  } | null;
}

export default function TicketPage() {
  const params = useParams();
  const bookingId = params.id as string;
  const { user } = useAuth();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const bookingRes = await api.get<BookingDetail>(
        `/bookings/${bookingId}`
      );
      setBooking(bookingRes.data);

      // Secure, payment-gated e-ticket (contains the QR). Backend returns 402
      // until payment is verified, so unpaid bookings do not expose a QR.
      try {
        const ticketRes = await api.get<Ticket>(
          `/bookings/${bookingId}/ticket`
        );
        setTicket(ticketRes.data);
      } catch (ticketErr: any) {
        if (ticketErr?.response?.status === 402) {
          setPaymentPending(true);
        }
        // Otherwise QR stays unavailable — booking details remain visible.
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load ticket');
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const downloadQrCode = () => {
    if (!ticket?.qr?.dataUrl) return;
    const link = document.createElement('a');
    link.href = ticket.qr.dataUrl;
    link.download = `etp-ticket-${bookingId}.png`;
    link.click();
  };

  const shareBooking = async () => {
    if (navigator.share && booking) {
      try {
        await navigator.share({
          title: 'ETP Travel Ticket',
          text: `Ticket #${booking.bookingCode} confirmed. Travel on ${formatDate(booking.travelDate)}`,
          url: window.location.href
        });
      } catch {
        /* user cancelled */
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please login to view your ticket</p>
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-64 bg-gray-200 rounded-xl" />
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
              <div className="space-y-3">
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ticket className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ticket Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'Could not load this ticket'}</p>
          <Link
            href="/dashboard"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const discount = booking.discountAmount;
  const finalAmount = booking.finalAmount;

  let passengers: Array<{ name: string; email: string; phone: string; seatNumber?: string }> = [];
  try {
    if (booking.passengerInfo) {
      const parsed = JSON.parse(booking.passengerInfo);
      if (Array.isArray(parsed)) passengers = parsed;
    }
  } catch {
    /* ignore */
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6"
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Ticket className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-blue-100">Extra Travel Point · Travel Pass</p>
                  <p className="text-xl font-bold">#{booking.bookingCode}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                booking.status === 'confirmed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {booking.status}
              </span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center sticky top-24"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Travel Pass QR</h2>

              {paymentPending ? (
                <div className="w-40 h-40 mx-auto bg-gray-50 rounded-lg border border-gray-200 mb-4 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">Payment required</span>
                </div>
              ) : ticket?.qr?.dataUrl ? (
                <div
                  className="w-40 h-40 mx-auto rounded-lg border border-gray-200 mb-4 flex items-center justify-center overflow-hidden"
                  role="img"
                  aria-label="Ticket QR Code"
                  style={{
                    backgroundImage: `url(${ticket.qr.dataUrl})`,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center'
                  }}
                />
              ) : ticket?.qr?.object ? (
                <div className="w-40 h-40 mx-auto mb-4 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
                  <QRCodeSVG value={JSON.stringify(ticket.qr.object)} size={160} level="H" />
                </div>
              ) : (
                <div className="w-40 h-40 mx-auto bg-gray-100 rounded-lg border border-gray-200 mb-4 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No QR available</span>
                </div>
              )}

              <p className="text-xs text-gray-500 mb-3">Show this QR at the boarding counter</p>

              <div className="flex gap-2">
                <button
                  onClick={downloadQrCode}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={shareBooking}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </motion.div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Trip Details</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm text-gray-500 flex items-center gap-1">
                    <Bus className="w-4 h-4" /> Service
                  </dt>
                  <dd className="font-medium text-gray-900 capitalize">{booking.category}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> Route
                  </dt>
                  <dd className="font-medium text-gray-900">{booking.route || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Travel Date
                  </dt>
                  <dd className="font-medium text-gray-900">{formatDate(booking.travelDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Booking Date</dt>
                  <dd className="font-medium text-gray-900">{formatDate(booking.bookingDate)}</dd>
                </div>
                {booking.provider?.businessName && (
                  <div>
                    <dt className="text-sm text-gray-500">Operator</dt>
                    <dd className="font-medium text-gray-900">{booking.provider.businessName}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-gray-500">Passengers</dt>
                  <dd className="font-medium text-gray-900">{booking.numberOfPeople} person(s)</dd>
                </div>
              </dl>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                Seats & Passengers
              </h2>

              {booking.seatNumbers && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Seat Number(s)</p>
                  <div className="flex flex-wrap gap-2">
                    {booking.seatNumbers.split(',').map((s) => (
                      <span key={s} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {passengers.length > 0 ? (
                <div className="space-y-3">
                  {passengers.map((p, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3">
                      <p className="font-medium text-gray-900">
                        {p.name}
                        {p.seatNumber && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Seat {p.seatNumber}</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">{p.phone} · {p.email}</p>
                    </div>
                  ))}
                </div>
              ) : booking.user ? (
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <dt className="text-sm text-gray-500">Name</dt>
                    <dd className="font-medium text-gray-900">{booking.user.fullName || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Phone</dt>
                    <dd className="font-medium text-gray-900">{booking.user.phone || 'N/A'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-gray-500">Passenger details not available</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-500" />
                Payment Summary
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mb-4">
                <div>
                  <dt className="text-sm text-gray-500">Payment Status</dt>
                  <dd className="font-medium text-gray-900 capitalize flex items-center gap-1">
                    {booking.paymentStatus === 'paid' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                    )}
                    {booking.paymentStatus}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Booking Status</dt>
                  <dd className="font-medium text-gray-900 capitalize">{booking.status}</dd>
                </div>
              </dl>

              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">BDT {booking.totalAmount.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-green-600 font-medium">-BDT {discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                  <span>Total Paid</span>
                  <span className="text-blue-700">BDT {finalAmount.toFixed(2)}</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link
                href="/dashboard"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium text-center transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Go to Dashboard
              </Link>
              <button
                onClick={downloadQrCode}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Ticket
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
