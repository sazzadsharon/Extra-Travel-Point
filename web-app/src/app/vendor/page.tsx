'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import {
  Store, Package, CheckCircle, Clock, XCircle, Users, Wallet,
  Plus, List, Ticket, AlertCircle, Loader2, Shield, TrendingUp, Banknote
} from 'lucide-react';
import type { VendorDashboard, Vendor, VendorStatus } from '../../types/vendor';

interface VendorEarnings {
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

const STATUS_STYLES: Record<VendorStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-gray-100 text-gray-800'
};

export default function VendorDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<VendorDashboard | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [earnings, setEarnings] = useState<VendorEarnings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dRes, mRes, eRes] = await Promise.all([
        api.get<VendorDashboard>(`/vendors/dashboard`),
        api.get<Vendor>(`/vendors/me`).catch(() => null),
        api.get<VendorEarnings>(`/vendors/me/earnings`).catch(() => null)
      ]);
      setDashboard(dRes.data);
      setVendor(mRes?.data ?? null);
      setEarnings(eRes?.data ?? null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'vendor') load(); }, [user, load]);

  if (user?.role !== 'vendor') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Vendor Access Required</h2>
          <p className="text-gray-600 mb-4">This area is for verified business partners.</p>
          <Link href="/vendor/register" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">Become a Vendor</Link>
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

  const status = vendor?.status;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendor Dashboard</h1>
            <p className="text-gray-500">{vendor?.businessName || 'Your business'}</p>
          </div>
          {status && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[status]}`}>
              {status.replace('_', ' ')}
            </span>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">{error}</div>}

        {status !== 'APPROVED' && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {status === 'PENDING'
              ? 'Your account is pending verification. You can prepare your profile but cannot publish services until approved.'
              : status === 'REJECTED'
              ? `Your application was rejected.${vendor?.rejectionReason ? ` Reason: ${vendor?.rejectionReason}` : ''}`
              : 'Your account is currently suspended. Please contact support.'}
          </div>
        )}

        {dashboard?.provider?.kycStatus && dashboard.provider.kycStatus !== 'NOT_SUBMITTED' && (
          <div className={`mb-6 px-4 py-3 rounded-lg flex items-center gap-2 ${
            dashboard.provider.kycStatus === 'APPROVED' ? 'bg-green-50 border border-green-200 text-green-800' :
            dashboard.provider.kycStatus === 'REJECTED' ? 'bg-red-50 border border-red-200 text-red-800' :
            'bg-yellow-50 border border-yellow-200 text-yellow-800'
          }`}>
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">KYC: {dashboard.provider.kycStatus.replace('_', ' ')}</span>
            {dashboard.provider.kycRejectionReason && <span className="text-sm ml-2">({dashboard.provider.kycRejectionReason})</span>}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat icon={<Package className="w-6 h-6 text-blue-600" />} label="Total Services" value={dashboard?.totalServices ?? 0} />
          <Stat icon={<CheckCircle className="w-6 h-6 text-green-600" />} label="Active Services" value={dashboard?.activeServices ?? 0} />
          <Stat icon={<Ticket className="w-6 h-6 text-purple-600" />} label="Bookings" value={dashboard?.bookings.total ?? 0} />
          <Stat icon={<Wallet className="w-6 h-6 text-indigo-600" />} label="Revenue (BDT)" value={(dashboard?.revenue.gross ?? 0).toFixed(0)} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Mini label="Pending" value={dashboard?.bookings.pending ?? 0} icon={<Clock className="w-4 h-4 text-yellow-500" />} />
          <Mini label="Confirmed" value={dashboard?.bookings.confirmed ?? 0} icon={<CheckCircle className="w-4 h-4 text-green-500" />} />
          <Mini label="Completed" value={dashboard?.bookings.completed ?? 0} icon={<Users className="w-4 h-4 text-blue-500" />} />
          <Mini label="Cancelled" value={dashboard?.bookings.cancelled ?? 0} icon={<XCircle className="w-4 h-4 text-red-500" />} />
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionCard href="/vendor/profile" icon={<Store className="w-5 h-5" />} title="Business Profile" />
          <ActionCard href="/vendor/kyc" icon={<Shield className="w-5 h-5" />} title="KYC Verification" />
          <ActionCard href="/vendor/services/new" icon={<Plus className="w-5 h-5" />} title="Add Service" disabled={status !== 'APPROVED'} />
          <ActionCard href="/vendor/services" icon={<List className="w-5 h-5" />} title="Manage Services" />
          <ActionCard href="/vendor/bookings" icon={<Ticket className="w-5 h-5" />} title="Bookings" />
          <ActionCard href="/vendor/payouts" icon={<Banknote className="w-5 h-5" />} title="Earnings & Payouts" />
        </div>

        {status === 'APPROVED' && earnings && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" /> Earnings
              </h2>
              <Link href="/vendor/payouts" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                View Settlements →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
              <MoneyCell label="Gross Sales" value={earnings.balance.grossSales} />
              <MoneyCell label="ETP Commission" value={earnings.balance.commissionTotal} tone="negative" />
              <MoneyCell label="Net Earnings" value={earnings.balance.netEarnings} tone="positive" />
              <MoneyCell label="Available Balance" value={earnings.balance.availableBalance} tone="positive" highlight />
              <MoneyCell label="Pending" value={earnings.balance.pendingBalance} />
              <MoneyCell label="Paid Out" value={earnings.balance.paidOut} />
            </div>
            <p className="text-xs text-gray-400">
              Settlement ledger is authoritative. Balance is calculated server-side.
            </p>
          </div>
        )}

        {status === 'APPROVED' && dashboard && !earnings && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><p className="text-gray-500">Gross (paid)</p><p className="font-bold text-gray-900">BDT {(dashboard.revenue.gross).toFixed(2)}</p></div>
              <div><p className="text-gray-500">ETP Commission ({dashboard.revenue.commissionRate}%)</p><p className="font-bold text-red-600">-BDT {dashboard.revenue.commission.toFixed(2)}</p></div>
              <div><p className="text-gray-500">Your Payable</p><p className="font-bold text-green-600">BDT {dashboard.revenue.vendorPayable.toFixed(2)}</p></div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Payouts are not processed in this environment.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-600">
        {icon}<span className="text-sm">{label}</span>
      </div>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );
}

function ActionCard({ href, icon, title, disabled }: { href: string; icon: React.ReactNode; title: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <div className="bg-gray-100 rounded-xl border border-gray-200 p-5 text-gray-400 flex items-center gap-3 cursor-not-allowed">
        <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">{icon}</div>
        <span className="font-medium">{title}</span>
      </div>
    );
  }
  return (
    <Link href={href} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3">
      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">{icon}</div>
      <span className="font-medium text-gray-900">{title}</span>
    </Link>
  );
}

function MoneyCell({
  label,
  value,
  tone,
  highlight
}: {
  label: string;
  value: number;
  tone?: 'positive' | 'negative';
  highlight?: boolean;
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-green-700'
      : tone === 'negative'
      ? 'text-red-600'
      : 'text-gray-900';
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-bold ${valueClass}`}>BDT {Number(value || 0).toFixed(2)}</p>
    </div>
  );
}
