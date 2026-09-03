'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../lib/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import { Store, CheckCircle, XCircle, Clock, AlertCircle, Loader2, ArrowLeft, Save } from 'lucide-react';
import type { Vendor, VendorStatus } from '../../../types/vendor';

const STATUS_STYLES: Record<VendorStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-gray-100 text-gray-800'
};

const STATUS_ICON: Record<VendorStatus, React.ReactNode> = {
  PENDING: <Clock className="w-4 h-4" />,
  APPROVED: <CheckCircle className="w-4 h-4" />,
  REJECTED: <XCircle className="w-4 h-4" />,
  SUSPENDED: <AlertCircle className="w-4 h-4" />
};

export default function VendorProfilePage() {
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState({
    businessName: '', category: '', description: '', address: '', city: '', phone: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<Vendor>(`/vendors/me`);
      setVendor(res.data);
      setForm({
        businessName: res.data.businessName,
        category: res.data.category,
        description: res.data.description || '',
        address: res.data.address,
        city: res.data.city || '',
        phone: res.data.phone || ''
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'vendor') load(); }, [user, load]);

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.patch(`/vendors/me`, form);
      setVendor(res.data.provider);
      setSaved(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (user?.role !== 'vendor') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Vendor access required.</p></div>;
  }
  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }
  if (!vendor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-center">
        <div>
          <p className="text-gray-600 mb-4">No vendor profile found.</p>
          <Link href="/vendor/register" className="bg-blue-600 text-white px-6 py-3 rounded-lg">Register as Vendor</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/vendor" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Business Profile</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${STATUS_STYLES[vendor.status]}`}>
            {STATUS_ICON[vendor.status]} {vendor.status.replace('_', ' ')}
          </span>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">{error}</div>}
        {saved && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Profile saved</div>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Labeled label="Business Name"><input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.businessName} onChange={e => update('businessName', e.target.value)} /></Labeled>
              <Labeled label="Category"><input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.category} onChange={e => update('category', e.target.value)} /></Labeled>
              <Labeled label="City"><input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.city} onChange={e => update('city', e.target.value)} /></Labeled>
              <Labeled label="Business Phone"><input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.phone} onChange={e => update('phone', e.target.value)} /></Labeled>
            </div>
            <Labeled label="Address"><input               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.address} onChange={e => update('address', e.target.value)} /></Labeled>
            <Labeled label="Description"><textarea               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={3} value={form.description} onChange={e => update('description', e.target.value)} /></Labeled>

            <div className="border-t border-gray-200 pt-4">
              <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2">
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Admin-Controlled Fields (read-only)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <ReadOnly label="Verification Status" value={vendor.status.replace('_', ' ')} />
            <ReadOnly label="Commission Rate" value={`${vendor.commissionRate}%`} />
            <ReadOnly label="Rating" value={`${vendor.rating} (${vendor.totalReviews} reviews)`} />
            <ReadOnly label="Reviewed By" value={vendor.reviewedBy ? `Admin #${vendor.reviewedBy}` : '—'} />
          </div>
          <p className="text-xs text-gray-400 mt-3">These fields are managed by ETP administrators and cannot be changed from this page.</p>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  );
}
