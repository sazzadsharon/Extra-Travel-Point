'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Banknote,
  Loader2,
  AlertCircle,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Shield
} from 'lucide-react';

interface PayoutRequest {
  id: number;
  providerId: number;
  amount: number;
  currency: string;
  method: string;
  status: string;
  rejectionReason?: string | null;
  transactionRef?: string | null;
  createdAt: string;
  paidAt?: string | null;
  processedAt?: string | null;
}

interface Settlement {
  id: number;
  bookingId: number;
  providerId: number;
  serviceId?: number | null;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  status: string;
  paidAt?: string | null;
  settledAt?: string | null;
  createdAt: string;
  booking?: {
    id: number;
    bookingCode: string;
    paymentStatus: string;
    status: string;
    travelDate: string;
    numberOfPeople: number;
  };
}

interface Earnings {
  providerId: number;
  balance: {
    currency: string;
    grossSales: number;
    commissionTotal: number;
    netEarnings: number;
    pendingBalance: number;
    paidOut: number;
    availableBalance: number;
    payoutRequested: number;
  };
  settlementCount: number;
  commissionRate: number;
}

const PAYOUT_METHODS = ['BANK', 'BKASH', 'NAGAD', 'ROCKET'];

const STATUS_STYLES: Record<string, string> = {
  PAYOUT_REQUESTED: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800'
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PAYOUT_REQUESTED: <Clock className="w-3 h-3" />,
  PROCESSING: <Loader2 className="w-3 h-3" />,
  PAID: <CheckCircle2 className="w-3 h-3" />,
  REJECTED: <XCircle className="w-3 h-3" />,
  CANCELLED: <XCircle className="w-3 h-3" />,
  pending: <Clock className="w-3 h-3" />,
  paid: <CheckCircle2 className="w-3 h-3" />
};

export default function VendorPayoutsPage() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK');
  const [payoutDetails, setPayoutDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (user?.role !== 'vendor') return;
    setIsLoading(true);
    setError(null);
    try {
      const [eRes, pRes, sRes] = await Promise.all([
        api.get<Earnings>('/vendors/me/earnings'),
        api.get<{ count: number; payouts: PayoutRequest[] }>('/vendors/me/payouts'),
        api.get<{ count: number; settlements: Settlement[] }>('/vendors/me/settlements')
      ]);
      setEarnings(eRes.data);
      setPayouts(pRes.data.payouts);
      setSettlements(sRes.data.settlements);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load financial data');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async () => {
    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    if (earnings && numericAmount > earnings.balance.availableBalance) {
      setError(`Amount exceeds available balance (BDT ${earnings.balance.availableBalance.toFixed(2)})`);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.post<{ message: string; payout: PayoutRequest }>(
        '/vendors/me/payouts',
        {
          amount: numericAmount,
          method,
          payoutDetails: payoutDetails.trim() || undefined
        }
      );
      setSuccessMsg(res.data.message);
      setAmount('');
      setPayoutDetails('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request payout');
    } finally {
      setSubmitting(false);
    }
  }, [amount, method, payoutDetails, earnings, load]);

  if (user?.role !== 'vendor') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Vendor Access Required</h2>
          <p className="text-gray-600 mb-4">This area is for verified vendors.</p>
          <Link href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium">Sign in</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Vendor Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-1">Earnings & Payouts</h1>
        <p className="text-gray-500 mb-6">Authoritative balance from the settlement ledger.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {earnings && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <Stat label="Available Balance" value={earnings.balance.availableBalance} icon={<Wallet className="w-5 h-5 text-blue-600" />} highlight />
            <Stat label="Gross Sales" value={earnings.balance.grossSales} icon={<TrendingUp className="w-5 h-5 text-indigo-600" />} />
            <Stat label="ETP Commission" value={earnings.balance.commissionTotal} icon={<Shield className="w-5 h-5 text-red-500" />} />
            <Stat label="Net Earnings" value={earnings.balance.netEarnings} icon={<Banknote className="w-5 h-5 text-green-600" />} />
            <Stat label="Pending Payouts" value={earnings.balance.payoutRequested} icon={<Clock className="w-5 h-5 text-yellow-500" />} />
            <Stat label="Paid Out" value={earnings.balance.paidOut} icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Payout</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (BDT)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={earnings ? `${earnings.balance.availableBalance.toFixed(2)} available` : '0.00'}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payout Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                >
                  {PAYOUT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account details (optional)</label>
                <textarea
                  rows={2}
                  value={payoutDetails}
                  onChange={(e) => setPayoutDetails(e.target.value)}
                  maxLength={500}
                  placeholder="Bank account / mobile wallet number"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={submit}
                disabled={submitting || !earnings || earnings.balance.availableBalance <= 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Banknote className="w-4 h-4" />
                    Submit Payout Request
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Payout Requests</h2>
            {payouts.length === 0 ? (
              <p className="text-gray-500 text-sm">No payout requests yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {payouts.slice(0, 5).map((p) => (
                  <li key={p.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        BDT {p.amount.toFixed(2)} via {p.method}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString()}
                        {p.transactionRef ? ` · ${p.transactionRef}` : ''}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${STATUS_STYLES[p.status] || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_ICONS[p.status]}
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Settlement Ledger</h2>
          {settlements.length === 0 ? (
            <p className="text-gray-500 text-sm">No settlements yet. They are created automatically when a paid service booking is confirmed.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4">Booking</th>
                    <th className="py-2 pr-4">Gross</th>
                    <th className="py-2 pr-4">Commission</th>
                    <th className="py-2 pr-4">Net</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-700">#{s.booking?.bookingCode?.slice(0, 8) ?? s.bookingId}</td>
                      <td className="py-2 pr-4">BDT {s.grossAmount.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-red-600">-BDT {s.commissionAmount.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-green-700 font-medium">BDT {s.netAmount.toFixed(2)}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${STATUS_STYLES[s.status] || 'bg-gray-100 text-gray-800'}`}>
                          {STATUS_ICONS[s.status]}
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  highlight
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl shadow-sm border p-5 ${highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-100">{icon}</div>
        <div>
          <p className={`text-2xl font-bold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>BDT {Number(value || 0).toFixed(2)}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}