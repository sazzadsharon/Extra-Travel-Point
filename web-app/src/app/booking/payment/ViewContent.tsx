'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Wallet, MapPin, Clock, Users, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../../contexts/AuthContext';
import { API_CONFIG } from '../../../config/api';

interface PaymentMethod {
  id: string;
  name: string;
  key: string;
  icon: React.ReactNode;
  description: string;
}

export default function PaymentView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const bookingId = searchParams.get('bookingId') || '';
  const totalAmount = parseFloat(searchParams.get('totalAmount') || '0');

  const [selectedMethod, setSelectedMethod] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paymentMethods: PaymentMethod[] = [
    { id: 'bkash', name: 'bKash', key: 'bkash', icon: <Wallet className="w-6 h-6" />, description: 'Pay via bKash Mobile Financial Service' },
    { id: 'nagad', name: 'Nagad', key: 'nagad', icon: <Wallet className="w-6 h-6" />, description: 'Pay via Nagad Digital Financial Service' },
    { id: 'rocket', name: 'Rocket', key: 'rocket', icon: <Wallet className="w-6 h-6" />, description: 'Pay via DBBL Rocket' },
    { id: 'sslcommerz', name: 'SSLCommerz', key: 'sslcommerz', icon: <CreditCard className="w-6 h-6" />, description: 'Pay via SSLCommerz Gateway' },
    { id: 'card', name: 'Card Payment', key: 'card', icon: <CreditCard className="w-6 h-6" />, description: 'Pay via Debit/Credit Card' },
  ];

  // Initiate payment
  const initiatePayment = useCallback(async () => {
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }
    if (!bookingId) {
      setError('Missing booking ID');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { default: axios } = await import('axios');
      const response = await axios.post(
        `${API_CONFIG.API_BASE_URL}/payments/initiate`,
        {
          bookingId: parseInt(bookingId),
          method: selectedMethod,
          amount: totalAmount
        }
      );

      const data = response.data;
      setTransactionId(data.transactionId);
      setPaymentUrl(data.paymentUrl);
      setPaymentResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedMethod, bookingId, totalAmount]);

  // Verify payment
  const verifyPayment = useCallback(async () => {
    if (!transactionId) return;

    setIsVerifying(true);
    setError(null);

    try {
      const { default: axios } = await import('axios');
      const response = await axios.post(
        `${API_CONFIG.API_BASE_URL}/payments/verify`,
        { transactionId }
      );

      const data = response.data;
      if (data.status === 'success') {
        setPaymentResult(data);
        // Redirect to success page
        router.push(`/booking/success?bookingId=${bookingId}&payment=success`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Payment verification failed');
    } finally {
      setIsVerifying(false);
    }
  }, [transactionId, bookingId, router]);

  // Handle payment initiation
  const handleInitiate = async () => {
    await initiatePayment();
  };

  // Auto-verify after a short delay (simulating payment callback)
  useEffect(() => {
    if (paymentUrl && !isVerifying) {
      const timer = setTimeout(() => {
        // In production, this would be called by the payment gateway callback
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [paymentUrl, isVerifying]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/booking/new?vehicleId=${searchParams.get('vehicleId')}&providerId=${searchParams.get('providerId')}&category=${searchParams.get('category') || searchParams.get('vehicleType')}&fromCity=${encodeURIComponent(searchParams.get('fromCity') || '')}&toCity=${encodeURIComponent(searchParams.get('toCity') || '')}&travelDate=${searchParams.get('travelDate')}&seats=${searchParams.get('seats')}&totalPrice=${searchParams.get('totalPrice')}`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Booking
        </Link>

        <div className="mb-8 flex items-center justify-center gap-2 sm:gap-4">
          {['Vehicle', 'Seats', 'Details', 'Payment', 'Confirm'].map((step, index) => (
            <React.Fragment key={step}>
              <div className={`flex items-center gap-2 ${index <= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {index + 1}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{step}</span>
              </div>
              {index < 4 && (
                <div className={`w-8 sm:w-12 h-0.5 ${index < 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Booking ID</span>
                  <span className="font-medium text-gray-900">#{bookingId}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium text-gray-900">BDT {totalAmount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Method</span>
                  <span className="font-medium text-gray-900 capitalize">{selectedMethod || 'None'}</span>
                </div>

                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-blue-700">BDT {totalAmount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Method</h2>
              <p className="text-gray-600 mb-6">Select your preferred payment method</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {paymentResult?.status === 'success' && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  Payment verified successfully!
                </div>
              )}

              <div className="space-y-3 mb-6">
                {paymentMethods.map(method => (
                  <button
                    key={method.key}
                    onClick={() => setSelectedMethod(method.id)}
                    disabled={isProcessing || isVerifying}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                      selectedMethod === method.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${isProcessing || isVerifying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      selectedMethod === method.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {method.icon}
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-gray-900">{method.name}</p>
                      <p className="text-sm text-gray-500">{method.description}</p>
                    </div>
                    {selectedMethod === method.id && (
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {!paymentUrl ? (
                  <button
                    onClick={handleInitiate}
                    disabled={!selectedMethod || isProcessing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Pay BDT {totalAmount}
                        <CreditCard className="w-5 h-5" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={verifyPayment}
                    disabled={isVerifying}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying Payment...
                      </>
                    ) : (
                      <>
                        Verify Payment
                        <Shield className="w-5 h-5" />
                      </>
                    )}
                  </button>
                )}
              </div>

              {transactionId && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
                  <p className="font-mono text-sm text-gray-900">{transactionId}</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}